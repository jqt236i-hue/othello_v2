import { JSDOM } from 'jsdom';

describe('match-mode network button behavior', () => {
  let dom;
  let createRoom;
  let joinRoom;
  let leaveRoom;
  let listRooms;
  let spectateRoom;

  test('レート戦条件カードにはAUTO無効の説明を表示しない', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
    const rulesSection = html.match(/<section class="rated-match-rules"[\s\S]*?<\/section>/);
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-layout-controls.css'), 'utf8');
    const initEvents = fs.readFileSync(path.resolve(__dirname, '..', 'ui', 'bootstrap', 'init-events.ts'), 'utf8');

    expect(rulesSection).not.toBeNull();
    expect(rulesSection![0]).toContain('デッキ');
    expect(rulesSection![0]).toContain('8x8固定');
    expect(rulesSection![0]).toContain('id="ratedMatchDeckNameText"');
    expect(rulesSection![0]).not.toContain('持ち込み可');
    expect(rulesSection![0]).not.toContain('AUTO');
    expect(rulesSection![0]).not.toContain('無効');
    expect(html).toContain('id="ratedMatchOverlay"');
    expect(html).toContain('id="ratedMatchLeaderboardBtn"');
    expect(html).toContain('id="ratedMatchHistoryBtn"');
    expect(html).toContain('id="ratedMatchHistoryPanel"');
    expect(html).toContain('rated-match-kicker');
    expect(html).toContain('rated-match-status-frame');
    expect(css).toContain('.rated-match-status-frame');
    expect(css).toContain('.rated-match-history-row');
    expect(css).toContain('#ratedMatchPanel.is-history-page');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(css).toContain('@media (max-width: 35em)');
    expect(initEvents).toContain('ratedMatchDeckOpenBtn: refs.ratedMatchDeckOpenBtn');
    expect(initEvents).toContain('ratedMatchDeckNameText: refs.ratedMatchDeckNameText');
    expect(initEvents).toContain('ratedMatchLeaderboardBtn: refs.ratedMatchLeaderboardBtn');
    expect(initEvents).toContain('ratedMatchHistoryBtn: refs.ratedMatchHistoryBtn');
  });

  function dispatchWheel(target, props) {
    const ev = new dom.window.Event('wheel', { bubbles: true, cancelable: true });
    const p = props || {};
    Object.defineProperty(ev, 'deltaX', { value: p.deltaX ?? 0 });
    Object.defineProperty(ev, 'deltaY', { value: p.deltaY ?? 0 });
    target.dispatchEvent(ev);
  }

  async function waitForCondition(predicate, attempts = 12) {
    for (let index = 0; index < attempts; index += 1) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(`condition was not met: ${JSON.stringify({
      queue: window.__RATED_MATCH_QUEUE || null,
      status: document.getElementById('ratedMatchStatus')?.textContent || '',
      queueDisabled: document.getElementById('ratedMatchQueueBtn')?.disabled || false
    })}`);
  }

  function buildUiRefs() {
    return {
      modeCpuBtn: document.getElementById('modeCpuBtn'),
      modeReversiBtn: document.getElementById('modeReversiBtn'),
      modeNetworkBtn: document.getElementById('modeNetworkBtn'),
      ratedMatchOpenBtn: document.getElementById('ratedMatchOpenBtn'),
      controlPanel: document.getElementById('control-panel'),
      networkPanel: document.getElementById('networkPanel'),
      networkServerInput: document.getElementById('networkServerInput'),
      networkPlayerNameInput: document.getElementById('networkPlayerNameInput'),
      networkRoomInput: document.getElementById('networkRoomIdInput'),
      networkBoardShapeSelect: document.getElementById('networkBoardShapeSelect'),
      networkBoardSizeRowsInput: document.getElementById('networkBoardSizeRowsInput'),
      networkBoardSizeColsInput: document.getElementById('networkBoardSizeColsInput'),
      networkBoardSizeSummary: document.getElementById('networkBoardSizeSummary'),
      networkBoardSizeNote: document.getElementById('networkBoardSizeNote'),
      networkTurnTimeSecondsInput: document.getElementById('networkTurnTimeSecondsInput'),
      networkEnableDebugCheckbox: document.getElementById('networkEnableDebugCheckbox'),
      networkEnableAutoCheckbox: document.getElementById('networkEnableAutoCheckbox'),
      networkAllCardsDeckCheckbox: document.getElementById('networkAllCardsDeckCheckbox'),
      networkCopyRoomBtn: document.getElementById('networkCopyRoomBtn'),
      networkRoomSettingsBtn: document.getElementById('networkRoomSettingsBtn'),
      networkRoomSettingsPopup: document.getElementById('networkRoomSettingsPopup'),
      networkRoomSettingsCloseBtn: document.getElementById('networkRoomSettingsCloseBtn'),
      networkCreateBtn: document.getElementById('networkCreateBtn'),
      networkJoinBtn: document.getElementById('networkJoinBtn'),
      networkLeaveBtn: document.getElementById('networkLeaveBtn'),
      networkOverlay: document.getElementById('networkOverlay'),
      networkCloseBtn: document.getElementById('networkCloseBtn'),
      ratedMatchOverlay: document.getElementById('ratedMatchOverlay'),
      ratedMatchCloseBtn: document.getElementById('ratedMatchCloseBtn'),
      ratedMatchQueueBtn: document.getElementById('ratedMatchQueueBtn'),
      ratedMatchCancelBtn: document.getElementById('ratedMatchCancelBtn'),
      ratedMatchStatus: document.getElementById('ratedMatchStatus'),
      ratedMatchQueueTimer: document.getElementById('ratedMatchQueueTimer'),
      ratedMatchDeckOpenBtn: document.getElementById('ratedMatchDeckOpenBtn'),
      ratedMatchDeckNameText: document.getElementById('ratedMatchDeckNameText'),
      ratedMatchDeckSummary: document.getElementById('ratedMatchDeckSummary'),
      ratedMatchLeaderboardBtn: document.getElementById('ratedMatchLeaderboardBtn'),
      ratedMatchHistoryBtn: document.getElementById('ratedMatchHistoryBtn'),
      ratedMatchHistoryPanel: document.getElementById('ratedMatchHistoryPanel'),
      ratedMatchHistoryStatus: document.getElementById('ratedMatchHistoryStatus'),
      ratedMatchHistoryList: document.getElementById('ratedMatchHistoryList'),
      ratedMatchRatingText: document.getElementById('ratedMatchRatingText'),
      ratedMatchIdentityText: document.getElementById('ratedMatchIdentityText'),
      leaderboardOpenBtn: document.getElementById('leaderboardOpenBtn'),
      leaderboardOverlay: document.getElementById('leaderboardOverlay'),
      leaderboardPanel: document.getElementById('leaderboardModal'),
      leaderboardCloseBtn: document.getElementById('leaderboardCloseBtn'),
      leaderboardNameInput: document.getElementById('leaderboardNameInput'),
      leaderboardReloadBtn: document.getElementById('leaderboardReloadBtn'),
      leaderboardStatus: document.getElementById('leaderboardStatusText'),
      leaderboardList: document.getElementById('leaderboardList'),
      networkStatus: document.getElementById('networkStatusText'),
      networkDeckInfo: document.getElementById('networkDeckInfo'),
      networkTimerStatus: document.getElementById('networkTimerStatus'),
      networkChatPanel: document.getElementById('networkChatPanel'),
      networkChatToggle: document.getElementById('networkChatToggle'),
      networkChatMessages: document.getElementById('networkChatMessages'),
      networkChatInput: document.getElementById('networkChatInput'),
      networkChatSendBtn: document.getElementById('networkChatSendBtn'),
      deckBuilderOpenBtn: document.getElementById('deckBuilderOpenBtn'),
      autoToggleBtn: document.getElementById('autoToggleBtn')
    };
  }

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<button id="modeCpuBtn">CPU</button>' +
      '<button id="modeReversiBtn">リバーシ</button>' +
      '<button id="modeNetworkBtn">ネット対戦</button>' +
      '<button id="ratedMatchOpenBtn" aria-expanded="false">レート戦</button>' +
      '<button id="autoToggleBtn">AUTO: OFF</button>' +
      '<div id="control-panel"></div>' +
      '<div id="networkPanel"></div>' +
      '<input id="networkServerInput" type="text" />' +
      '<input id="networkPlayerNameInput" type="text" />' +
      '<input id="networkRoomIdInput" type="text" />' +
      '<div id="networkBoardSizeRow">' +
      '<div id="networkBoardSizeHeader"><span id="networkBoardSizeTitle">盤面サイズ</span><span id="networkBoardSizeSummary"></span></div>' +
      '<select id="networkBoardShapeSelect"><option value="rectangle">通常</option><option value="circle">円形</option></select>' +
      '<div id="networkBoardSizeInputs">' +
      '<label for="networkBoardSizeRowsInput">縦</label>' +
      '<input id="networkBoardSizeRowsInput" type="number" value="8" />' +
      '<span>x</span>' +
      '<label for="networkBoardSizeColsInput">横</label>' +
      '<input id="networkBoardSizeColsInput" type="number" value="8" />' +
      '</div>' +
      '<div id="networkBoardSizeNote"></div>' +
      '</div>' +
      '<input id="networkTurnTimeSecondsInput" type="number" min="3" max="1800" value="120" />' +
      '<input id="networkEnableDebugCheckbox" type="checkbox" />' +
      '<input id="networkEnableAutoCheckbox" type="checkbox" />' +
      '<input id="networkAllCardsDeckCheckbox" type="checkbox" />' +
      '<button id="networkCopyRoomBtn">部屋番号コピー</button>' +
      '<button id="networkRoomSettingsBtn" aria-controls="networkRoomSettingsPopup" aria-expanded="false">設定</button>' +
      '<div id="networkRoomSettingsPopup" aria-hidden="true"></div>' +
      '<button id="networkRoomSettingsCloseBtn">閉じる</button>' +
      '<button id="networkCreateBtn">部屋作成</button>' +
      '<button id="networkJoinBtn">参加</button>' +
      '<button id="networkLeaveBtn">退出</button>' +
      '<div id="networkOverlay"></div>' +
      '<button id="networkCloseBtn">閉じる</button>' +
      '<div id="ratedMatchOverlay" aria-hidden="true">' +
      '<div id="ratedMatchModal">' +
      '<button id="ratedMatchCloseBtn">閉じる</button>' +
      '<div id="ratedMatchPanel">' +
      '<div id="ratedMatchRatingText"></div>' +
      '<div id="ratedMatchIdentityText"></div>' +
      '<button id="ratedMatchDeckOpenBtn" type="button"><span>デッキ</span><strong id="ratedMatchDeckNameText"></strong></button>' +
      '<div id="ratedMatchDeckSummary"></div>' +
      '<button id="ratedMatchLeaderboardBtn" type="button">レートランキング</button>' +
      '<button id="ratedMatchHistoryBtn" type="button" aria-expanded="false" aria-controls="ratedMatchHistoryPanel">直近10戦</button>' +
      '<div id="ratedMatchHistoryPanel" hidden>' +
      '<div id="ratedMatchHistoryStatus"></div>' +
      '<div id="ratedMatchHistoryList"></div>' +
      '</div>' +
      '<div id="ratedMatchStatus"></div>' +
      '<button id="ratedMatchQueueBtn">キューに入る</button>' +
      '<button id="ratedMatchCancelBtn">待機解除</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div id="ratedMatchQueueTimer" hidden></div>' +
      '<button id="leaderboardOpenBtn">ランキング</button>' +
      '<div id="leaderboardOverlay" aria-hidden="true">' +
      '<div id="leaderboardModal">' +
      '<button id="leaderboardCloseBtn">閉じる</button>' +
      '<input id="leaderboardNameInput" />' +
      '<button id="leaderboardCategoryScore" class="leaderboard-filter-tab" data-category="score" type="button">スコアランキング</button>' +
      '<button id="leaderboardCategoryRated" class="leaderboard-filter-tab" data-category="rated" type="button">レートランキング</button>' +
      '<button id="leaderboardCategoryTimeAttack" class="leaderboard-filter-tab" data-category="timeAttack" type="button">タイムアタック</button>' +
      '<button id="leaderboardCategoryTimeDefense" class="leaderboard-filter-tab" data-category="timeDefense" type="button">最長手数</button>' +
      '<button id="leaderboardCategoryShortestTurns" class="leaderboard-filter-tab" data-category="shortestTurns" type="button">最短手数</button>' +
      '<button id="leaderboardReloadBtn">更新</button>' +
      '<div id="leaderboardStatusText"></div>' +
      '<div id="leaderboardList"></div>' +
      '</div>' +
      '</div>' +
      '<div id="networkStatusText"></div>' +
      '<div id="networkDeckInfo"></div>' +
      '<div id="networkTimerStatus"></div>' +
      '<div id="networkChatPanel" aria-hidden="true">' +
      '<button id="networkChatToggle" type="button"></button>' +
      '<div id="networkChatMessages"></div>' +
      '<input id="networkChatInput" type="text" />' +
      '<button id="networkChatSendBtn" type="button"></button>' +
      '</div>' +
      '<div id="deck-white"></div>' +
      '<div id="deck-black"></div>' +
      '<div id="hand-white"></div>' +
      '<div id="hand-black"></div>' +
      '<div id="card-detail-panel"></div>' +
      '<div id="discard-display"></div>' +
      '<div id="effect-live-panel"></div>' +
      '<button id="deckBuilderOpenBtn"></button>' +
      '<div id="deckBuilderControlSummary"></div>' +
      '<button id="gachaOpenBtn"></button>' +
      '<div class="control-group" id="cpuLevelGroup"><select id="smartBlack"></select><select id="smartWhite"></select></div>' +
      '<div id="charge-black"></div>' +
      '<div id="charge-white"></div>' +
      '<div id="charge-delta-black-increase"></div>' +
      '<div id="charge-delta-black-decrease"></div>' +
      '<div id="charge-delta-white-increase"></div>' +
      '<div id="charge-delta-white-decrease"></div>' +
      '</body></html>',
      { url: 'http://localhost/' }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;
    global.addLog = jest.fn();
    global.updateCpuCharacter = jest.fn();
    window.showCpuSpeechBubble = jest.fn();
    window.showHeroSpeechBubble = jest.fn();
    window.setNetworkDebugModeAccess = jest.fn();

    createRoom = jest.fn(async () => ({ ok: true, roomId: 'A1B', networkDebugEnabled: true }));
    joinRoom = jest.fn(async () => ({ ok: true, roomId: 'A1B', networkDebugEnabled: false }));
    leaveRoom = jest.fn(async () => ({ ok: true }));
    listRooms = jest.fn(async () => ({ ok: true, rooms: [] }));
    spectateRoom = jest.fn(async () => ({ ok: true, roomId: 'SPC', viewerRole: 'spectator' }));
    window.NetworkMatchClient = {
      createRoom,
      joinRoom,
      spectateRoom,
      leaveRoom,
      listRooms,
      getServerUrl: jest.fn(() => ''),
      enterRatedQueue: jest.fn(async () => ({
        ok: true,
        status: 'waiting',
        queuedAt: Date.now(),
        expiresAt: Date.now() + 600000,
        remainingMs: 600000,
        serverTime: Date.now()
      })),
      pollRatedQueue: jest.fn(async () => ({
        ok: true,
        status: 'waiting',
        queuedAt: Date.now(),
        expiresAt: Date.now() + 600000,
        remainingMs: 600000,
        serverTime: Date.now()
      })),
      cancelRatedQueue: jest.fn(async () => ({ ok: true, status: 'cancelled' })),
      getMyRating: jest.fn(async () => ({
        ok: true,
        displayRating: 1500,
        rating: { ratedGames: 0 }
      })),
      getMyRatingHistory: jest.fn(async () => ({
        ok: true,
        entries: []
      })),
      adoptMatchedRoom: jest.fn(async () => ({ ok: true, roomId: 'RAT', seatKey: 'white' })),
      restoreStoredSession: jest.fn(async () => ({ ok: false, reason: 'NO_STORED_SESSION' })),
      setStatusWriter: jest.fn(),
      setRoomStateListener: jest.fn(),
      setTurnTimerListener: jest.fn((listener) => {
        if (typeof listener !== 'function') return;
        listener({
          limitSeconds: 120,
          active: false,
          turnSeatKey: 'black',
          remainingMs: null,
          isOwnTurn: false
        });
      }),
      setChatListener: jest.fn(),
      isSpectator: jest.fn(() => false),
      hasTwoPlayers: jest.fn(() => false),
      getSeatNames: jest.fn(() => ({ black: '', white: '' })),
      getSeatKey: jest.fn(() => 'black')
    };
    window.LeaderboardClient = {
      fetchLeaderboard: jest.fn(async () => ({ ok: true, entries: [], updatedAt: 0 })),
      getRatedLeaderboard: jest.fn(async () => ({ ok: true, entries: [], updatedAt: 0, category: 'rated' }))
    };

    const matchMode = require('../ui/handlers/match-mode.ts');
    window.setupMatchModeControls = matchMode.setupMatchModeControls;
    window.MatchMode = matchMode;
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
    delete global.localStorage;
    delete global.addLog;
    delete global.updateCpuCharacter;
  });

  test('ネット対戦中にネット対戦ボタンを再押下してもCPUへ戻らない', async () => {
    const networkBtn = document.getElementById('modeNetworkBtn');
    const closeBtn = document.getElementById('networkCloseBtn');
    const overlay = document.getElementById('networkOverlay');

    expect(document.querySelectorAll('link[data-card-reversi-feature-style="network"]')).toHaveLength(0);
    networkBtn.click();
    await Promise.resolve();
    expect(window.MatchMode.getCurrentMode()).toBe('network');
    expect(overlay.classList.contains('is-open')).toBe(true);
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="network"]')).toHaveLength(1);

    closeBtn.click();
    expect(overlay.classList.contains('is-open')).toBe(false);

    networkBtn.click();
    await Promise.resolve();

    expect(window.MatchMode.getCurrentMode()).toBe('network');
    expect(overlay.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('modeCpuBtn').style.outline).toBe('');
    expect(document.getElementById('modeNetworkBtn').style.outline).not.toBe('');
    expect(leaveRoom).not.toHaveBeenCalled();
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="network"]')).toHaveLength(1);
  });

  test('ネット対戦の名前欄は変更確定だけでプロフィール名として保存する', async () => {
    window.LeaderboardClient.setPlayerName = jest.fn((value) => value);
    window.LeaderboardClient.updatePublicProfile = jest.fn(async () => ({ ok: true }));

    const playerInput = document.getElementById('networkPlayerNameInput');

    playerInput.value = '  新しい名前  ';
    playerInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(window.LeaderboardClient.setPlayerName).toHaveBeenCalledWith('新しい名前');
    expect(window.LeaderboardClient.updatePublicProfile).toHaveBeenCalledTimes(1);

    playerInput.value = '閉じる前';
    playerInput.dispatchEvent(new dom.window.Event('blur', { bubbles: true }));

    expect(window.LeaderboardClient.setPlayerName).toHaveBeenLastCalledWith('閉じる前');
    expect(window.LeaderboardClient.updatePublicProfile).toHaveBeenCalledTimes(2);
  });

  test('ランキング機能が遅延読込でも、保存済みプロフィール名をネット対戦名へ復元する', async () => {
    localStorage.setItem('card_reversi_player_profile_v1', JSON.stringify({
      version: 1,
      displayName: '保存済み名',
      avatarStoneType: 'REGEN',
      bio: '',
      updatedAt: Date.now()
    }));
    delete window.LeaderboardClient;

    const playerInput = document.getElementById('networkPlayerNameInput');
    playerInput.value = '';
    window.setupMatchModeControls(buildUiRefs());

    expect(playerInput.value).toBe('保存済み名');

    document.getElementById('modeNetworkBtn').click();
    await Promise.resolve();

    expect(playerInput.value).toBe('保存済み名');
  });

  test('ランキング機能が遅延読込でも、ネット対戦名の変更をプロフィールへ保存する', () => {
    delete window.LeaderboardClient;
    const playerInput = document.getElementById('networkPlayerNameInput');

    playerInput.value = '  次回の名前  ';
    playerInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    const profile = JSON.parse(localStorage.getItem('card_reversi_player_profile_v1') || '{}');
    expect(playerInput.value).toBe('次回の名前');
    expect(profile.displayName).toBe('次回の名前');
  });

  test('レート戦ボタンは通常プレイを維持したまま専用キューに入れる', async () => {
    const identity = {
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      playerToken: `pt_${'A'.repeat(43)}`,
      recoveryCode: 'CR-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA'
    };
    window.PlayerIdentity = {
      getPlayerIdentity: jest.fn(() => identity),
      ensurePlayerIdentity: jest.fn(async () => identity)
    };

    const ratedBtn = document.getElementById('ratedMatchOpenBtn');
    const ratedOverlay = document.getElementById('ratedMatchOverlay');
    const networkOverlay = document.getElementById('networkOverlay');
    const closeBtn = document.getElementById('ratedMatchCloseBtn');
    const queueBtn = document.getElementById('ratedMatchQueueBtn');
    const cancelBtn = document.getElementById('ratedMatchCancelBtn');
    const status = document.getElementById('ratedMatchStatus');
    const timer = document.getElementById('ratedMatchQueueTimer');

    expect(document.querySelectorAll('link[data-card-reversi-feature-style="leaderboard"]')).toHaveLength(0);
    ratedBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.MatchMode.getCurrentMode()).toBe('cpu');
    expect(ratedOverlay.classList.contains('is-open')).toBe(true);
    expect(document.querySelectorAll('link[data-card-reversi-feature-style="leaderboard"]')).toHaveLength(1);
    expect(networkOverlay.classList.contains('is-open')).toBe(false);
    expect(ratedBtn.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('autoToggleBtn').textContent).toBe('AUTO: OFF');
    expect(ratedOverlay.textContent).toContain('1500');
    expect(ratedOverlay.textContent).not.toContain('RD');
    expect(ratedOverlay.textContent).not.toContain('volatility');

    queueBtn.click();
    await waitForCondition(() => window.__RATED_MATCH_QUEUE?.status === 'waiting');

    expect(window.PlayerIdentity.ensurePlayerIdentity).toHaveBeenCalled();
    expect(window.NetworkMatchClient.enterRatedQueue).toHaveBeenCalledWith(expect.objectContaining({
      playerName: 'ななし',
      playerId: identity.playerId,
      playerToken: identity.playerToken,
      roomBoardConfig: { rows: 8, cols: 8, standard8x8: true },
      networkAutoEnabled: false
    }));
    expect(window.MatchMode.getCurrentMode()).toBe('cpu');
    expect(status.textContent).toContain('キュー待機中');
    expect(status.classList.contains('is-waiting')).toBe(true);
    expect(timer.hidden).toBe(false);
    expect(timer.textContent).toContain('10:00');
    expect(queueBtn.disabled).toBe(true);
    expect(cancelBtn.disabled).toBe(false);
    expect(window.__RATED_MATCH_QUEUE).toEqual(expect.objectContaining({
      status: 'waiting',
      queueType: 'rated',
      playerId: identity.playerId,
      boardConfig: { rows: 8, cols: 8, standard8x8: true },
      constraints: expect.objectContaining({
        deckCarryAllowed: true,
        autoPlayAllowed: false
      })
    }));

    closeBtn.click();
    expect(ratedOverlay.classList.contains('is-open')).toBe(false);
    ratedBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(ratedOverlay.classList.contains('is-open')).toBe(true);
    expect(window.__RATED_MATCH_QUEUE).toEqual(expect.objectContaining({
      status: 'waiting',
      queueType: 'rated',
      playerId: identity.playerId,
      deck: expect.objectContaining({
        mode: 'default',
        deckSize: 30
      })
    }));

    cancelBtn.click();
    await Promise.resolve();
    expect(window.__RATED_MATCH_QUEUE).toEqual(expect.objectContaining({
      status: 'idle',
      queueType: 'rated'
    }));
    expect(queueBtn.disabled).toBe(false);
    expect(cancelBtn.disabled).toBe(true);
  });

  test('レート戦モーダルは現在使用中デッキ名を条件カードへ表示する', async () => {
    window.UIBootstrap = {
      getRegisteredUIGlobals: jest.fn(() => ({
        DeckBuilderController: {
          getActiveLocalChoice: jest.fn(() => ({
            mode: 'custom',
            name: '観測デッキ',
            deckCode: '',
            deckSize: 7
          }))
        }
      }))
    };

    document.getElementById('ratedMatchOpenBtn').click();
    await Promise.resolve();

    expect(document.getElementById('ratedMatchDeckNameText').textContent).toBe('観測デッキ');
    expect(document.getElementById('ratedMatchDeckSummary').textContent).toBe('使用デッキ: 観測デッキ');
  });

  test('レート戦モーダルのランキングボタンはレートランキングを開く', async () => {
    document.getElementById('ratedMatchOpenBtn').click();
    await Promise.resolve();

    document.getElementById('ratedMatchLeaderboardBtn').click();

    await waitForCondition(() => document.getElementById('leaderboardOverlay').classList.contains('is-open'));

    expect(document.getElementById('ratedMatchOverlay').classList.contains('is-open')).toBe(false);
    expect(document.getElementById('leaderboardCategoryRated').classList.contains('is-active')).toBe(true);
    expect(window.LeaderboardClient.getRatedLeaderboard).toHaveBeenCalled();

    document.getElementById('leaderboardCloseBtn').click();

    expect(document.getElementById('leaderboardOverlay').classList.contains('is-open')).toBe(false);
    expect(document.getElementById('ratedMatchOverlay').classList.contains('is-open')).toBe(true);
    expect(window.__returnToRatedMatchAfterLeaderboard).toBe(false);
  });

  test('レート戦モーダルのデッキ枠はデッキ構築を開く', async () => {
    const deckOpenHandler = jest.fn();
    document.getElementById('deckBuilderOpenBtn').addEventListener('click', deckOpenHandler);

    document.getElementById('ratedMatchOpenBtn').click();
    await Promise.resolve();

    document.getElementById('ratedMatchDeckOpenBtn').click();

    expect(document.getElementById('ratedMatchOverlay').classList.contains('is-open')).toBe(false);
    expect(deckOpenHandler).toHaveBeenCalledTimes(1);
  });

  test('レート戦モーダルの直近10戦ボタンは勝敗とポイント増減を表示する', async () => {
    const identity = {
      playerId: 'p_HISTORYPLAYER01',
      playerToken: `pt_${'H'.repeat(43)}`,
      recoveryCode: 'CR-HHHHH-HHHHH-HHHHH-HHHHH-HHHHH'
    };
    window.PlayerIdentity = {
      getPlayerIdentity: jest.fn(() => identity),
      ensurePlayerIdentity: jest.fn(async () => identity)
    };
    window.NetworkMatchClient.getMyRatingHistory.mockResolvedValueOnce({
      ok: true,
      entries: [{
        matchId: 'history-1',
        result: 'WIN',
        displayBeforeRating: 1500,
        displayAfterRating: 1518,
        displayDelta: 18,
        ratedAt: '2026-06-25T00:00:00.000Z'
      }, {
        matchId: 'history-2',
        result: 'LOSS',
        displayBeforeRating: 1518,
        displayAfterRating: 1509,
        displayDelta: -9,
        ratedAt: '2026-06-24T00:00:00.000Z'
      }]
    });

    document.getElementById('ratedMatchOpenBtn').click();
    document.getElementById('ratedMatchHistoryBtn').click();

    await waitForCondition(() => document.getElementById('ratedMatchHistoryList').textContent.includes('+18'));

    expect(window.NetworkMatchClient.getMyRatingHistory).toHaveBeenCalledWith(identity.playerId, 10);
    expect(document.getElementById('ratedMatchHistoryPanel').hidden).toBe(false);
    expect(document.getElementById('ratedMatchPanel').classList.contains('is-history-page')).toBe(true);
    expect(document.getElementById('ratedMatchCloseBtn').getAttribute('aria-label')).toBe('レート戦へ戻る');
    expect(document.getElementById('ratedMatchHistoryStatus').textContent).toBe('2戦を表示中');
    expect(document.getElementById('ratedMatchHistoryList').textContent).toContain('勝利');
    expect(document.getElementById('ratedMatchHistoryList').textContent).toContain('敗北');
    expect(document.getElementById('ratedMatchHistoryList').textContent).toContain('1500 → 1518');
    expect(document.getElementById('ratedMatchHistoryList').textContent).toContain('-9');

    document.getElementById('ratedMatchCloseBtn').click();

    expect(document.getElementById('ratedMatchOverlay').classList.contains('is-open')).toBe(true);
    expect(document.getElementById('ratedMatchHistoryPanel').hidden).toBe(true);
    expect(document.getElementById('ratedMatchPanel').classList.contains('is-history-page')).toBe(false);
    expect(document.getElementById('ratedMatchCloseBtn').getAttribute('aria-label')).toBe('レート戦を閉じる');

    document.getElementById('ratedMatchHistoryBtn').click();
    await waitForCondition(() => document.getElementById('ratedMatchPanel').classList.contains('is-history-page'));

    document.getElementById('ratedMatchOverlay').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    expect(document.getElementById('ratedMatchOverlay').classList.contains('is-open')).toBe(true);
    expect(document.getElementById('ratedMatchHistoryPanel').hidden).toBe(true);
    expect(document.getElementById('ratedMatchPanel').classList.contains('is-history-page')).toBe(false);
  });

  test('レート戦キューは10分で自動解除される', async () => {
    const originalNow = Date.now;
    try {
      const startMs = 1_700_000_000_000;
      let nowMs = startMs;
      Date.now = jest.fn(() => nowMs) as any;
      const identity = {
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        playerToken: `pt_${'B'.repeat(43)}`,
        recoveryCode: 'CR-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB'
      };
      window.PlayerIdentity = {
        getPlayerIdentity: jest.fn(() => identity),
        ensurePlayerIdentity: jest.fn(async () => identity)
      };
      window.NetworkMatchClient.enterRatedQueue.mockResolvedValueOnce({
        ok: true,
        status: 'waiting',
        queuedAt: startMs,
        expiresAt: startMs + 600000,
        remainingMs: 600000,
        serverTime: startMs
      });

      document.getElementById('ratedMatchOpenBtn').click();
      document.getElementById('ratedMatchQueueBtn').click();
      await waitForCondition(() => window.__RATED_MATCH_QUEUE?.status === 'waiting');

      expect(window.__RATED_MATCH_QUEUE.status).toBe('waiting');
      expect(document.getElementById('ratedMatchQueueTimer').hidden).toBe(false);

      nowMs = startMs + 600000;
      window.__RatedMatchControllerTest.tick();

      expect(window.NetworkMatchClient.cancelRatedQueue).toHaveBeenCalledWith(expect.objectContaining({
        playerId: identity.playerId,
        playerToken: identity.playerToken,
        reason: 'timeout'
      }));
      expect(window.__RATED_MATCH_QUEUE).toEqual(expect.objectContaining({
        status: 'idle',
        reason: 'timeout'
      }));
      expect(document.getElementById('ratedMatchQueueTimer').hidden).toBe(true);
    } finally {
      Date.now = originalNow;
    }
  });

  test('レート戦が成立したときだけネット対戦セッションへ接続する', async () => {
    const identity = {
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      playerToken: `pt_${'C'.repeat(43)}`,
      recoveryCode: 'CR-CCCCC-CCCCC-CCCCC-CCCCC-CCCCC'
    };
    const roomPayload = {
      ok: true,
      roomId: 'RAT',
      roomName: 'レート戦',
      seatKey: 'white',
      seatToken: 'seat_white_token',
      playerName: 'ななし',
      roomBoardConfig: { rows: 8, cols: 8, standard8x8: true },
      networkAutoEnabled: false,
      stateVersion: 1,
      snapshot: { gameState: { board: [[0]], currentPlayer: 'black' }, cardState: {} }
    };
    window.PlayerIdentity = {
      getPlayerIdentity: jest.fn(() => identity),
      ensurePlayerIdentity: jest.fn(async () => identity)
    };
    window.NetworkMatchClient.enterRatedQueue.mockResolvedValueOnce({
      ok: true,
      status: 'matched',
      queuedAt: Date.now(),
      expiresAt: Date.now() + 600000,
      match: {
        roomId: 'RAT',
        seatKey: 'white',
        payload: roomPayload
      },
      serverTime: Date.now()
    });

    document.getElementById('ratedMatchOpenBtn').click();
    document.getElementById('ratedMatchQueueBtn').click();
    await waitForCondition(() => window.NetworkMatchClient.adoptMatchedRoom.mock.calls.length > 0);

    expect(window.NetworkMatchClient.adoptMatchedRoom).toHaveBeenCalledWith(roomPayload, expect.objectContaining({
      source: 'rated_queue'
    }));
    expect(window.MatchMode.getCurrentMode()).toBe('network');
    expect(window.__RATED_MATCH_QUEUE).toEqual(expect.objectContaining({
      status: 'matched',
      queueType: 'rated',
      roomId: 'RAT',
      seatKey: 'white'
    }));
    expect(document.getElementById('ratedMatchQueueTimer').hidden).toBe(true);
  });

  test('部屋作成設定ボタンは空のポップアップを開閉する', () => {
    const settingsBtn = document.getElementById('networkRoomSettingsBtn');
    const settingsPopup = document.getElementById('networkRoomSettingsPopup');
    const settingsCloseBtn = document.getElementById('networkRoomSettingsCloseBtn');
    const networkCloseBtn = document.getElementById('networkCloseBtn');

    expect(settingsPopup.classList.contains('is-open')).toBe(false);
    expect(settingsPopup.getAttribute('aria-hidden')).toBe('true');
    expect(settingsBtn.getAttribute('aria-expanded')).toBe('false');

    settingsBtn.click();
    expect(settingsPopup.classList.contains('is-open')).toBe(true);
    expect(settingsPopup.getAttribute('aria-hidden')).toBe('false');
    expect(settingsBtn.getAttribute('aria-expanded')).toBe('true');

    settingsCloseBtn.click();
    expect(settingsPopup.classList.contains('is-open')).toBe(false);
    expect(settingsPopup.getAttribute('aria-hidden')).toBe('true');
    expect(settingsBtn.getAttribute('aria-expanded')).toBe('false');

    settingsBtn.click();
    expect(settingsPopup.classList.contains('is-open')).toBe(true);
    networkCloseBtn.click();
    expect(settingsPopup.classList.contains('is-open')).toBe(false);
    expect(settingsPopup.getAttribute('aria-hidden')).toBe('true');
    expect(settingsBtn.getAttribute('aria-expanded')).toBe('false');
  });

  test('初期化直後に部屋盤面情報が未確定でも 8x8 表示へ安全にフォールバックする', () => {
    expect(document.getElementById('networkDeckInfo').textContent).toBe('作成時に送るデッキ: デフォルトデッキ / 作成時に送る盤面: 8x8');
  });

  test('ネット対戦チャット新着は席に応じて自分側か相手側の吹き出しへ表示する', () => {
    const chatListener = window.NetworkMatchClient.setChatListener.mock.calls[0][0];
    expect(typeof chatListener).toBe('function');

    chatListener({
      type: 'history',
      messages: [{ id: 1, seatKey: 'white', text: '履歴', serverTime: 1 }]
    });

    expect(window.showHeroSpeechBubble).not.toHaveBeenCalled();
    expect(window.showCpuSpeechBubble).not.toHaveBeenCalled();

    chatListener({
      type: 'message',
      message: { id: 2, seatKey: 'black', text: '自分の発言', serverTime: 2 }
    });
    chatListener({
      type: 'message',
      message: { id: 3, seatKey: 'white', text: '相手の発言', serverTime: 3 }
    });

    expect(window.showHeroSpeechBubble).toHaveBeenCalledWith('自分の発言');
    expect(window.showCpuSpeechBubble).toHaveBeenCalledWith('相手の発言');
    expect(document.getElementById('networkChatMessages').textContent).toContain('黒: 自分の発言');
    expect(document.getElementById('networkChatMessages').textContent).toContain('白: 相手の発言');
  });

  test('観測中の手番タイマーは自席扱いの「あなた」を表示しない', async () => {
    window.NetworkMatchClient.isSpectator.mockReturnValue(true);
    await window.MatchMode.setMode('network', { silentLog: true });
    const timerListener = window.NetworkMatchClient.setTurnTimerListener.mock.calls[0][0];

    timerListener({
      limitSeconds: 120,
      active: true,
      turnSeatKey: 'black',
      remainingMs: 93000,
      isOwnTurn: true
    });

    expect(document.getElementById('networkTimerStatus').textContent).toBe('手番タイマー: 黒 残り 93 秒');
  });

  test('手番タイマー未受信でも既定制限を使ってネット対戦モードを表示できる', async () => {
    await window.MatchMode.setMode('network', { silentLog: true });

    expect(document.getElementById('networkTimerStatus').textContent)
      .toBe('手番タイマー: 待機中（制限 120 秒）');
  });

  test('起動時に保存済み観戦セッションを復帰してネット対戦モードへ戻す', async () => {
    window.NetworkMatchClient.restoreStoredSession.mockResolvedValueOnce({
      ok: true,
      restored: true,
      roomId: 'SPC',
      viewerRole: 'spectator'
    });

    window.setupMatchModeControls(buildUiRefs());
    await Promise.resolve();
    await Promise.resolve();

    expect(window.NetworkMatchClient.restoreStoredSession).toHaveBeenCalled();
    expect(window.MatchMode.getCurrentMode()).toBe('network');
    expect(document.getElementById('networkStatusText').textContent).toContain('復帰');
    expect(document.getElementById('networkTimerStatus').style.display).toBe('block');
  });

  test('リバーシモードはカード系UIを隠しCPUレベル選択を残す', async () => {
    document.getElementById('modeReversiBtn').click();
    await Promise.resolve();

    expect(window.MatchMode.getCurrentMode()).toBe('reversi');
    expect(document.body.classList.contains('reversi-mode-active')).toBe(true);
    expect(document.body.classList.contains('othello-mode-active')).toBe(true);
    expect(window.DEBUG_HUMAN_VS_HUMAN).toBe(false);
    expect(document.getElementById('hand-black').hidden).toBe(true);
    expect(document.getElementById('card-detail-panel').hidden).toBe(true);
    expect(document.getElementById('discard-display').hidden).toBe(true);
    expect(document.getElementById('cpuLevelGroup').hidden).toBe(false);
  });

  test('ネット対戦モードへ切り替えると stale な HvH debug flag を落とす', async () => {
    window.DEBUG_HUMAN_VS_HUMAN = true;
    window.__uiImpl_turn_manager = { DEBUG_HUMAN_VS_HUMAN: true };
    window.__uiImpl_move_executor = { DEBUG_HUMAN_VS_HUMAN: true };
    window.__uiImpl = { DEBUG_HUMAN_VS_HUMAN: true };

    document.getElementById('modeNetworkBtn').click();
    await Promise.resolve();

    expect(window.MatchMode.getCurrentMode()).toBe('network');
    expect(window.DEBUG_HUMAN_VS_HUMAN).toBe(false);
    expect(window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN).toBe(false);
    expect(window.__uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN).toBe(false);
    expect(window.__uiImpl.DEBUG_HUMAN_VS_HUMAN).toBe(false);
  });

  test('ネット対戦モーダルの盤面サイズ変更は pending 表示と部屋作成 payload に反映される', async () => {
    let localBoardConfig = { rows: 8, cols: 8, standard8x8: true };
    const setLocalBoardConfig = jest.fn((nextBoardConfig) => {
      const rows = Number.isFinite(Number(nextBoardConfig && nextBoardConfig.rows)) ? Number(nextBoardConfig.rows) : 8;
      const cols = Number.isFinite(Number(nextBoardConfig && nextBoardConfig.cols)) ? Number(nextBoardConfig.cols) : 8;
      const shape = String(nextBoardConfig && nextBoardConfig.shape || '').toLowerCase() === 'circle' ? 'circle' : 'rectangle';
      localBoardConfig = {
        rows,
        cols,
        shape,
        standard8x8: shape === 'rectangle' && rows === 8 && cols === 8
      };
    });

    window.UIBootstrap = {
      getRegisteredUIGlobals: jest.fn(() => ({
        DeckBuilderController: {
          getLocalBoardConfig: jest.fn(() => Object.assign({}, localBoardConfig)),
          setLocalBoardConfig,
          getActiveLocalChoice: jest.fn(() => ({ mode: 'standard', deckSize: 30 }))
        }
      }))
    };

    const networkBtn = document.getElementById('modeNetworkBtn');
    const playerInput = document.getElementById('networkPlayerNameInput');
    const rowsInput = document.getElementById('networkBoardSizeRowsInput');
    const colsInput = document.getElementById('networkBoardSizeColsInput');
    const createBtn = document.getElementById('networkCreateBtn');

    networkBtn.click();
    await Promise.resolve();

    rowsInput.value = '7';
    rowsInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    colsInput.value = '9';
    colsInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(setLocalBoardConfig).toHaveBeenCalled();
    expect(document.getElementById('networkBoardSizeSummary').textContent).toBe('7x9');
    expect(document.getElementById('networkDeckInfo').textContent).toBe('作成時に送るデッキ: デフォルト 30枚 / 作成時に送る盤面: 7x9');

    playerInput.value = 'くろ';
    createBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({
      playerName: 'くろ',
      roomBoardConfig: expect.objectContaining({
        rows: 7,
        cols: 9,
        standard8x8: false
      })
    }));
  });

  test('無効なカスタム deckCode は標準デッキへフォールバックして部屋作成する', async () => {
    window.UIBootstrap = {
      getRegisteredUIGlobals: jest.fn(() => ({
        DeckBuilderController: {
          getLocalBoardConfig: jest.fn(() => ({ rows: 8, cols: 8, standard8x8: true })),
          getActiveLocalChoice: jest.fn(() => ({
            mode: 'custom',
            deckCode: 'BROKEN_DECK',
            deckSize: 30
          }))
        }
      }))
    };

    const playerInput = document.getElementById('networkPlayerNameInput');
    const createBtn = document.getElementById('networkCreateBtn');

    playerInput.value = 'くろ';
    createBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({
      playerName: 'くろ',
      deckCode: ''
    }));
    expect(document.getElementById('networkStatusText').textContent).toContain('標準デッキで続行します');
  });

  test('持ち時間は直接入力とホイール10秒刻みの両方で変更できる', async () => {
    const input = document.getElementById('networkTurnTimeSecondsInput') as HTMLInputElement;
    const playerInput = document.getElementById('networkPlayerNameInput') as HTMLInputElement;

    document.getElementById('modeNetworkBtn').click();
    await Promise.resolve();

    expect(input.value).toBe('120');
    input.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true }));
    expect(input.value).toBe('130');
    input.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: 1, bubbles: true, cancelable: true }));
    expect(input.value).toBe('120');

    input.value = '2';
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(input.value).toBe('3');

    input.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: 1, bubbles: true, cancelable: true }));
    expect(input.value).toBe('3');

    input.value = '1795';
    input.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true }));
    expect(input.value).toBe('1800');
    input.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true }));
    expect(input.value).toBe('1800');

    input.value = '37';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    playerInput.value = 'くろ';
    document.getElementById('networkCreateBtn').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({ turnTimeSeconds: 37 }));
  });

  test('両者全カードデッキを選ぶと部屋作成 payload に反映される', async () => {
    window.UIBootstrap = {
      getRegisteredUIGlobals: jest.fn(() => ({
        DeckBuilderController: {
          getLocalBoardConfig: jest.fn(() => ({ rows: 8, cols: 8, standard8x8: true })),
          getActiveLocalChoice: jest.fn(() => ({
            mode: 'custom',
            deckCode: 'D1C1:LOCAL',
            deckSize: 30
          }))
        }
      }))
    };

    const networkBtn = document.getElementById('modeNetworkBtn');
    const playerInput = document.getElementById('networkPlayerNameInput');
    const allCardsCheckbox = document.getElementById('networkAllCardsDeckCheckbox');
    const createBtn = document.getElementById('networkCreateBtn');

    networkBtn.click();
    await Promise.resolve();

    allCardsCheckbox.checked = true;
    allCardsCheckbox.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(document.getElementById('networkDeckInfo').textContent).toContain('両者全カードデッキ');

    playerInput.value = 'くろ';
    createBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({
      playerName: 'くろ',
      allCardsDeckEnabled: true
    }));
  });

  test('無効なカスタム deckCode は標準デッキへフォールバックして部屋参加する', async () => {
    window.UIBootstrap = {
      getRegisteredUIGlobals: jest.fn(() => ({
        DeckBuilderController: {
          getLocalBoardConfig: jest.fn(() => ({ rows: 8, cols: 8, standard8x8: true })),
          getActiveLocalChoice: jest.fn(() => ({
            mode: 'custom',
            deckCode: 'BROKEN_DECK',
            deckSize: 30
          }))
        }
      }))
    };

    const playerInput = document.getElementById('networkPlayerNameInput');
    const networkBtn = document.getElementById('modeNetworkBtn');
    listRooms.mockResolvedValue({
      ok: true,
      rooms: [{
        roomId: 'A1B',
        roomName: '無名部屋',
        hostName: 'くろ',
        boardLabel: '8x8',
        seatCount: 1,
        maxSeats: 2,
        hasPassword: false
      }]
    });
    playerInput.value = 'しろ';
    networkBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const joinEntryBtn = document.querySelector('.network-room-entry-join');
    expect(joinEntryBtn).toBeTruthy();
    joinEntryBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(joinRoom).toHaveBeenCalledWith('A1B', expect.objectContaining({
      playerName: 'しろ',
      deckCode: ''
    }));
    expect(document.getElementById('networkStatusText').textContent).toContain('標準デッキで続行します');
  });

  test('ルーム一覧から参加すると開いたままの一覧人数を更新する', async () => {
    const playerInput = document.getElementById('networkPlayerNameInput');
    const networkBtn = document.getElementById('modeNetworkBtn');
    listRooms
      .mockResolvedValueOnce({
        ok: true,
        rooms: [{
          roomId: 'A1B',
          roomName: '無名部屋',
          hostName: 'くろ',
          boardLabel: '8x8',
          seatCount: 1,
          maxSeats: 2,
          spectatorCount: 0,
          maxSpectators: 4,
          canJoin: true,
          canSpectate: true,
          hasPassword: false
        }]
      })
      .mockResolvedValueOnce({
        ok: true,
        rooms: [{
          roomId: 'A1B',
          roomName: '無名部屋',
          hostName: 'くろ',
          boardLabel: '8x8',
          seatCount: 2,
          maxSeats: 2,
          spectatorCount: 0,
          maxSpectators: 4,
          canJoin: false,
          canSpectate: true,
          hasPassword: false
        }]
      });

    playerInput.value = 'しろ';
    networkBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const list = document.getElementById('networkRoomList');
    expect(list.textContent).toContain('1/2');

    const joinEntryBtn = document.querySelector('.network-room-entry-join');
    expect(joinEntryBtn).toBeTruthy();
    joinEntryBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(joinRoom).toHaveBeenCalledWith('A1B', expect.objectContaining({
      playerName: 'しろ'
    }));
    expect(listRooms).toHaveBeenCalledTimes(2);
    expect(list.textContent).toContain('2/2');
  });

  test('ルーム一覧の古い応答が新しい更新結果を上書きしない', async () => {
    const resolvers = [];
    listRooms.mockImplementation(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }));

    document.getElementById('modeNetworkBtn').click();
    await waitForCondition(() => listRooms.mock.calls.length === 1);

    document.getElementById('networkRoomListRefreshBtn').click();
    await waitForCondition(() => listRooms.mock.calls.length === 2);

    resolvers[1]({
      ok: true,
      rooms: [{
        roomId: 'NEW',
        roomName: '新しい一覧',
        hostName: 'しん',
        boardLabel: '8x8',
        seatCount: 1,
        maxSeats: 2,
        canJoin: true,
        canSpectate: true
      }]
    });
    await waitForCondition(() => document.getElementById('networkRoomList').textContent.includes('新しい一覧'));

    resolvers[0]({
      ok: true,
      rooms: [{
        roomId: 'OLD',
        roomName: '古い一覧',
        hostName: 'ふる',
        boardLabel: '8x8',
        seatCount: 1,
        maxSeats: 2,
        canJoin: true,
        canSpectate: true
      }]
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById('networkRoomList').textContent).toContain('新しい一覧');
    expect(document.getElementById('networkRoomList').textContent).not.toContain('古い一覧');
  });

  test('ネット対戦ロビーはルーム一覧を専用viewportでラップする', async () => {
    const networkBtn = document.getElementById('modeNetworkBtn');
    listRooms.mockResolvedValue({ ok: true, rooms: [] });

    networkBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const viewport = document.getElementById('networkRoomListViewport');
    const list = document.getElementById('networkRoomList');
    expect(viewport).toBeTruthy();
    expect(list).toBeTruthy();
    expect(viewport.contains(list)).toBe(true);
    expect(list.parentElement).toBe(viewport);
  });

  test('参加中ルームのカードは退出ボタンを表示して既存退出処理を使う', async () => {
    const networkBtn = document.getElementById('modeNetworkBtn');
    window.NetworkMatchClient.getRoomId = jest.fn(() => 'A1B');
    listRooms.mockResolvedValue({
      ok: true,
      rooms: [{
        roomId: 'A1B',
        roomName: '参加中部屋',
        hostName: 'くろ',
        boardLabel: '8x8',
        seatCount: 2,
        maxSeats: 2,
        spectatorCount: 0,
        maxSpectators: 4,
        canJoin: false,
        canSpectate: true,
        hasPassword: false
      }]
    });

    networkBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const currentEntry = document.querySelector('.network-room-list-entry.is-current-room');
    expect(currentEntry).toBeTruthy();
    expect(currentEntry.textContent).toContain('参加済み');
    expect(currentEntry.querySelector('.network-room-entry-versus').textContent.replace(/\s+/g, '')).toBe('くろVS参加者');
    const leaveEntryBtn = currentEntry.querySelector('.network-room-entry-leave');
    expect(leaveEntryBtn).toBeTruthy();
    expect(leaveEntryBtn.textContent).toBe('退出');
    expect(leaveEntryBtn.getAttribute('aria-label')).toBe('参加中部屋から退出');

    const leaveCallsBeforeClick = leaveRoom.mock.calls.length;
    leaveEntryBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(leaveRoom).toHaveBeenCalledTimes(leaveCallsBeforeClick + 1);
    expect(window.MatchMode.getCurrentMode()).toBe('cpu');
  });

  test('ルーム一覧のVS表示は参加者の設定名を使う', async () => {
    const networkBtn = document.getElementById('modeNetworkBtn');
    listRooms.mockResolvedValue({
      ok: true,
      rooms: [{
        roomId: 'NAM',
        roomName: '名前部屋',
        hostName: '長名前先手七字',
        blackPlayerName: '長名前先手七字',
        whitePlayerName: '挑戦者白七文字',
        seatNames: { black: '長名前先手七字', white: '挑戦者白七文字' },
        boardLabel: '8x8',
        seatCount: 2,
        maxSeats: 2,
        spectatorCount: 0,
        maxSpectators: 4,
        canJoin: false,
        canSpectate: true,
        hasPassword: false
      }]
    });

    networkBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const entry = document.querySelector('.network-room-list-entry');
    expect(entry).toBeTruthy();
    expect(entry.querySelector('.network-room-entry-versus').textContent.replace(/\s+/g, '')).toBe('長名前先手七字VS挑戦者白七文字');
    expect(Array.from(entry.querySelectorAll('.network-room-entry-mark')).every((mark) => mark.classList.contains('is-long-name'))).toBe(true);
    expect(entry.querySelector('.network-room-entry-versus').textContent).not.toContain('参加者');
  });

  test('満席でも観戦可能なルームは観測ボタンから参加できる', async () => {
    const playerInput = document.getElementById('networkPlayerNameInput');
    const networkBtn = document.getElementById('modeNetworkBtn');
    listRooms.mockResolvedValue({
      ok: true,
      rooms: [{
        roomId: 'SPC',
        roomName: '観戦部屋',
        hostName: '黒',
        seatCount: 2,
        maxSeats: 2,
        spectatorCount: 1,
        maxSpectators: 4,
        canJoin: false,
        canSpectate: true,
        hasPassword: false,
        boardLabel: '8x8'
      }]
    });

    playerInput.value = 'みる';
    networkBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const buttons = Array.from(document.querySelectorAll('button'));
    const spectateEntryBtn = buttons.find((button) => /観戦部屋を観測/.test(button.getAttribute('aria-label') || ''));
    expect(spectateEntryBtn).toBeTruthy();
    expect(document.getElementById('networkRoomList').textContent).toContain('観測 1/4');

    spectateEntryBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(spectateRoom).toHaveBeenCalledWith('SPC', expect.objectContaining({
      playerName: 'みる',
      roomPassword: '',
      serverUrl: ''
    }));
    expect(joinRoom).not.toHaveBeenCalled();
    expect(document.getElementById('networkOverlay').classList.contains('is-open')).toBe(false);
    expect(document.getElementById('networkStatusText').textContent).toContain('観測中');
  });

  test('ネット対戦モーダルの盤面サイズ入力はホイールで 16x16 まで増減できる', async () => {
    let localBoardConfig = { rows: 8, cols: 8, standard8x8: true };
    const setLocalBoardConfig = jest.fn((nextBoardConfig) => {
      const rows = Number.isFinite(Number(nextBoardConfig && nextBoardConfig.rows)) ? Number(nextBoardConfig.rows) : 8;
      const cols = Number.isFinite(Number(nextBoardConfig && nextBoardConfig.cols)) ? Number(nextBoardConfig.cols) : 8;
      localBoardConfig = {
        rows,
        cols,
        standard8x8: rows === 8 && cols === 8
      };
    });

    window.UIBootstrap = {
      getRegisteredUIGlobals: jest.fn(() => ({
        DeckBuilderController: {
          getLocalBoardConfig: jest.fn(() => Object.assign({}, localBoardConfig)),
          setLocalBoardConfig,
          getActiveLocalChoice: jest.fn(() => ({ mode: 'standard', deckSize: 30 }))
        }
      }))
    };

    const networkBtn = document.getElementById('modeNetworkBtn');
    const rowsInput = document.getElementById('networkBoardSizeRowsInput');
    const colsInput = document.getElementById('networkBoardSizeColsInput');

    networkBtn.click();
    await Promise.resolve();

    expect(rowsInput.max).toBe('16');
    expect(colsInput.max).toBe('16');

    rowsInput.value = '15';
    colsInput.value = '15';
    dispatchWheel(rowsInput, { deltaY: -100 });
    dispatchWheel(colsInput, { deltaY: -100 });

    expect(setLocalBoardConfig).toHaveBeenCalled();
    expect(document.getElementById('networkBoardSizeSummary').textContent).toBe('16x16');
    expect(document.getElementById('networkDeckInfo').textContent).toBe('作成時に送るデッキ: デフォルト 30枚 / 作成時に送る盤面: 16x16');

    const shapeSelect = document.getElementById('networkBoardShapeSelect');
    shapeSelect.value = 'circle';
    shapeSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(setLocalBoardConfig).toHaveBeenLastCalledWith(expect.objectContaining({ rows: 16, cols: 16, shape: 'circle' }));
    expect(rowsInput.min).toBe('6');
    expect(rowsInput.max).toBe('16');
    expect(rowsInput.step).toBe('2');
    expect(rowsInput.disabled).toBe(false);
    expect({
      summary: document.getElementById('networkBoardSizeSummary').textContent,
      deck: document.getElementById('networkDeckInfo').textContent,
      lastConfig: setLocalBoardConfig.mock.calls.at(-1)?.[0]
    }).toEqual({
      summary: '円形 16x16 / 208マス',
      deck: '作成時に送るデッキ: デフォルト 30枚 / 作成時に送る盤面: 円形 16x16 / 208マス',
      lastConfig: expect.objectContaining({ rows: 16, cols: 16, shape: 'circle' })
    });

    rowsInput.value = '12';
    rowsInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(colsInput.value).toBe('12');
    expect(document.getElementById('networkBoardSizeSummary').textContent).toBe('円形 12x12 / 112マス');
  });

  test('部屋盤面が確定したらネット対戦モーダルの盤面サイズ入力をロックする', () => {
    const roomStateListener = window.NetworkMatchClient.setRoomStateListener.mock.calls[0][0];
    expect(typeof roomStateListener).toBe('function');

    roomStateListener({
      roomBoardConfig: { rows: 7, cols: 8 }
    });

    expect(document.getElementById('networkBoardSizeRowsInput').disabled).toBe(true);
    expect(document.getElementById('networkBoardSizeColsInput').disabled).toBe(true);
    expect(document.getElementById('networkBoardSizeSummary').textContent).toBe('7x8 / 部屋固定');
    expect(document.getElementById('networkBoardSizeNote').textContent).toBe('ネット対戦中は部屋で決めた盤面形状とサイズを使います');
  });

  test('部屋参加中は接続先・作成・参加の操作をロックする', () => {
    window.NetworkMatchClient.isActive = jest.fn(() => true);
    const roomStateListener = window.NetworkMatchClient.setRoomStateListener.mock.calls[0][0];

    roomStateListener({
      roomId: 'ABC',
      roomBoardConfig: { rows: 8, cols: 8 }
    });

    expect(document.getElementById('networkServerInput').disabled).toBe(true);
    expect(document.getElementById('networkCreateBtn').disabled).toBe(true);
    expect(document.getElementById('networkJoinBtn').disabled).toBe(true);
  });

  test('CPUボタン押下ではネット対戦からCPUへ戻る', async () => {
    const networkBtn = document.getElementById('modeNetworkBtn');
    const cpuBtn = document.getElementById('modeCpuBtn');

    networkBtn.click();
    await Promise.resolve();
    expect(window.MatchMode.getCurrentMode()).toBe('network');

    cpuBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.MatchMode.getCurrentMode()).toBe('cpu');
    expect(leaveRoom).toHaveBeenCalledTimes(1);
  });

  test('ルーム名コピーボタンで入力値をコピーできる', async () => {
    const roomInput = document.getElementById('networkRoomIdInput');
    const copyBtn = document.getElementById('networkCopyRoomBtn');
    const status = document.getElementById('networkStatusText');
    const writeText = jest.fn(async () => undefined);

    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    roomInput.value = '対戦部屋';
    copyBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('対戦部屋');
    expect(roomInput.value).toBe('対戦部屋');
    expect(status.textContent).toContain('対戦部屋');
  });

  test('ルーム名が空なら無名部屋としてコピーできる', async () => {
    const roomInput = document.getElementById('networkRoomIdInput');
    const copyBtn = document.getElementById('networkCopyRoomBtn');
    const status = document.getElementById('networkStatusText');
    const writeText = jest.fn(async () => undefined);

    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    roomInput.value = '';
    copyBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('無名部屋');
    expect(status.textContent).toContain('無名部屋');
  });

  test('部屋作成時にデバッグ有効チェックを付けるとcreate payloadへ反映される', async () => {
    const networkBtn = document.getElementById('modeNetworkBtn');
    const playerInput = document.getElementById('networkPlayerNameInput');
    const debugCheckbox = document.getElementById('networkEnableDebugCheckbox');
    const createBtn = document.getElementById('networkCreateBtn');
    window.setDebugModeEnabled = jest.fn(() => true);

    networkBtn.click();
    await Promise.resolve();

    playerInput.value = 'くろ';
    debugCheckbox.checked = true;
    createBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({
      playerName: 'くろ',
      networkDebugEnabled: true
    }));
    expect(window.setNetworkDebugModeAccess).toHaveBeenCalledWith(expect.objectContaining({
      networkMode: true,
      roomDebugEnabled: true
    }));
    expect(window.setDebugModeEnabled).toHaveBeenCalledWith(true);
  });

  test('デバッグチェック未選択では create payload に networkDebugEnabled を載せない', async () => {
    const networkBtn = document.getElementById('modeNetworkBtn');
    const playerInput = document.getElementById('networkPlayerNameInput');
    const debugCheckbox = document.getElementById('networkEnableDebugCheckbox');
    const createBtn = document.getElementById('networkCreateBtn');
    window.setDebugModeEnabled = jest.fn(() => true);
    createRoom.mockResolvedValueOnce({ ok: true, roomId: 'A1B', networkDebugEnabled: false });

    networkBtn.click();
    await Promise.resolve();

    playerInput.value = 'くろ';
    debugCheckbox.checked = false;
    createBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({
      playerName: 'くろ'
    }));
    expect(createRoom).not.toHaveBeenCalledWith(expect.objectContaining({
      networkDebugEnabled: true
    }));
    expect(window.setNetworkDebugModeAccess).toHaveBeenCalledWith(expect.objectContaining({
      networkMode: true,
      roomDebugEnabled: false
    }));
    expect(window.setDebugModeEnabled).not.toHaveBeenCalled();
  });
});
