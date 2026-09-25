import { JSDOM } from 'jsdom';

describe('match-mode network button behavior', () => {
  let dom;
  let createRoom;
  let joinRoom;
  let leaveRoom;
  let listRooms;
  let spectateRoom;

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
    throw new Error('condition was not met');
  }

  function buildUiRefs() {
    return {
      modeCpuBtn: document.getElementById('modeCpuBtn'),
      modeReversiBtn: document.getElementById('modeReversiBtn'),
      modeNetworkBtn: document.getElementById('modeNetworkBtn'),
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
      '<button id="leaderboardOpenBtn">ランキング</button>' +
      '<div id="leaderboardOverlay" aria-hidden="true">' +
      '<div id="leaderboardModal">' +
      '<button id="leaderboardCloseBtn">閉じる</button>' +
      '<input id="leaderboardNameInput" />' +
      '<button id="leaderboardCategoryScore" class="leaderboard-filter-tab" data-category="score" type="button">スコアランキング</button>' +
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

  test('部屋状態が変わらない snapshot では updateCpuCharacter を繰り返さない', () => {
    window.NetworkMatchClient.isActive = jest.fn(() => true);
    const roomStateListener = window.NetworkMatchClient.setRoomStateListener.mock.calls[0][0];
    const roomState = {
      active: true,
      roomId: 'ABC',
      viewerRole: 'seat',
      seatKey: 'black',
      seats: { black: true, white: true },
      seatNames: { black: 'A', white: 'B' },
      seatHandSkins: { black: 'default', white: 'default' },
      roomBoardConfig: { rows: 8, cols: 8 },
      hasTwoPlayers: true
    };
    const updateCpuCharacter = jest.fn();
    window.updateCpuCharacter = updateCpuCharacter;
    try {
      roomStateListener({ ...roomState });
      roomStateListener({ ...roomState, seatNames: { ...roomState.seatNames } });
      expect(updateCpuCharacter).toHaveBeenCalledTimes(1);

      roomStateListener({ ...roomState, seatHandSkins: { black: 'default', white: 'skin-b' } });
      expect(updateCpuCharacter).toHaveBeenCalledTimes(2);

      roomStateListener({ ...roomState, seatHandSkins: { black: 'default', white: 'skin-b' }, seats: { black: true, white: false } });
      expect(updateCpuCharacter).toHaveBeenCalledTimes(3);
    } finally {
      delete window.updateCpuCharacter;
    }
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
