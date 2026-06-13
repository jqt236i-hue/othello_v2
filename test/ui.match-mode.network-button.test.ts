import { JSDOM } from 'jsdom';

describe('match-mode network button behavior', () => {
  let dom;
  let createRoom;
  let joinRoom;
  let leaveRoom;
  let listRooms;

  function dispatchWheel(target, props) {
    const ev = new dom.window.Event('wheel', { bubbles: true, cancelable: true });
    const p = props || {};
    Object.defineProperty(ev, 'deltaX', { value: p.deltaX ?? 0 });
    Object.defineProperty(ev, 'deltaY', { value: p.deltaY ?? 0 });
    target.dispatchEvent(ev);
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
      networkBoardSizeRowsInput: document.getElementById('networkBoardSizeRowsInput'),
      networkBoardSizeColsInput: document.getElementById('networkBoardSizeColsInput'),
      networkBoardSizeSummary: document.getElementById('networkBoardSizeSummary'),
      networkBoardSizeNote: document.getElementById('networkBoardSizeNote'),
      networkEnableDebugCheckbox: document.getElementById('networkEnableDebugCheckbox'),
      networkCopyRoomBtn: document.getElementById('networkCopyRoomBtn'),
      networkCreateBtn: document.getElementById('networkCreateBtn'),
      networkJoinBtn: document.getElementById('networkJoinBtn'),
      networkLeaveBtn: document.getElementById('networkLeaveBtn'),
      networkOverlay: document.getElementById('networkOverlay'),
      networkCloseBtn: document.getElementById('networkCloseBtn'),
      networkStatus: document.getElementById('networkStatusText'),
      networkDeckInfo: document.getElementById('networkDeckInfo'),
      networkTimerStatus: document.getElementById('networkTimerStatus'),
      networkChatPanel: document.getElementById('networkChatPanel'),
      networkChatToggle: document.getElementById('networkChatToggle'),
      networkChatMessages: document.getElementById('networkChatMessages'),
      networkChatInput: document.getElementById('networkChatInput'),
      networkChatSendBtn: document.getElementById('networkChatSendBtn'),
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
      '<div id="networkBoardSizeInputs">' +
      '<label for="networkBoardSizeRowsInput">縦</label>' +
      '<input id="networkBoardSizeRowsInput" type="number" value="8" />' +
      '<span>x</span>' +
      '<label for="networkBoardSizeColsInput">横</label>' +
      '<input id="networkBoardSizeColsInput" type="number" value="8" />' +
      '</div>' +
      '<div id="networkBoardSizeNote"></div>' +
      '</div>' +
      '<input id="networkEnableDebugCheckbox" type="checkbox" />' +
      '<button id="networkCopyRoomBtn">部屋番号コピー</button>' +
      '<button id="networkCreateBtn">部屋作成</button>' +
      '<button id="networkJoinBtn">参加</button>' +
      '<button id="networkLeaveBtn">退出</button>' +
      '<div id="networkOverlay"></div>' +
      '<button id="networkCloseBtn">閉じる</button>' +
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
    global.addLog = jest.fn();
    global.updateCpuCharacter = jest.fn();
    window.showCpuSpeechBubble = jest.fn();
    window.showHeroSpeechBubble = jest.fn();
    window.setNetworkDebugModeAccess = jest.fn();

    createRoom = jest.fn(async () => ({ ok: true, roomId: 'A1B', networkDebugEnabled: true }));
    joinRoom = jest.fn(async () => ({ ok: true, roomId: 'A1B', networkDebugEnabled: false }));
    leaveRoom = jest.fn(async () => ({ ok: true }));
    listRooms = jest.fn(async () => ({ ok: true, rooms: [] }));
    window.NetworkMatchClient = {
      createRoom,
      joinRoom,
      leaveRoom,
      listRooms,
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
      hasTwoPlayers: jest.fn(() => false),
      getSeatNames: jest.fn(() => ({ black: '', white: '' })),
      getSeatKey: jest.fn(() => 'black')
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
  });

  test('ネット対戦中にネット対戦ボタンを再押下してもCPUへ戻らない', async () => {
    const networkBtn = document.getElementById('modeNetworkBtn');
    const closeBtn = document.getElementById('networkCloseBtn');
    const overlay = document.getElementById('networkOverlay');

    networkBtn.click();
    await Promise.resolve();
    expect(window.MatchMode.getCurrentMode()).toBe('network');
    expect(overlay.classList.contains('is-open')).toBe(true);

    closeBtn.click();
    expect(overlay.classList.contains('is-open')).toBe(false);

    networkBtn.click();
    await Promise.resolve();

    expect(window.MatchMode.getCurrentMode()).toBe('network');
    expect(overlay.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('modeCpuBtn').style.outline).toBe('');
    expect(document.getElementById('modeNetworkBtn').style.outline).not.toBe('');
    expect(leaveRoom).not.toHaveBeenCalled();
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

  test('ネット対戦モーダルの盤面サイズ入力はホイールで 10x10 まで増減できる', async () => {
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

    expect(rowsInput.max).toBe('10');
    expect(colsInput.max).toBe('10');

    dispatchWheel(rowsInput, { deltaY: -100 });
    dispatchWheel(rowsInput, { deltaY: -100 });
    dispatchWheel(rowsInput, { deltaY: -100 });
    dispatchWheel(colsInput, { deltaY: -100 });
    dispatchWheel(colsInput, { deltaY: -100 });

    expect(setLocalBoardConfig).toHaveBeenCalled();
    expect(document.getElementById('networkBoardSizeSummary').textContent).toBe('10x10');
    expect(document.getElementById('networkDeckInfo').textContent).toBe('作成時に送るデッキ: デフォルト 30枚 / 作成時に送る盤面: 10x10');
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
    expect(document.getElementById('networkBoardSizeNote').textContent).toBe('ネット対戦中は部屋で決めた盤面サイズを使います');
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
