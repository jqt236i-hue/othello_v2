const { JSDOM } = require('jsdom');

describe('match-mode network button behavior', () => {
  let dom;
  let createRoom;
  let joinRoom;
  let leaveRoom;

  function buildUiRefs() {
    return {
      modeCpuBtn: document.getElementById('modeCpuBtn'),
      modeNetworkBtn: document.getElementById('modeNetworkBtn'),
      controlPanel: document.getElementById('control-panel'),
      networkPanel: document.getElementById('networkPanel'),
      networkServerInput: document.getElementById('networkServerInput'),
      networkPlayerNameInput: document.getElementById('networkPlayerNameInput'),
      networkRoomInput: document.getElementById('networkRoomIdInput'),
      networkEnableDebugCheckbox: document.getElementById('networkEnableDebugCheckbox'),
      networkCopyRoomBtn: document.getElementById('networkCopyRoomBtn'),
      networkCreateBtn: document.getElementById('networkCreateBtn'),
      networkJoinBtn: document.getElementById('networkJoinBtn'),
      networkLeaveBtn: document.getElementById('networkLeaveBtn'),
      networkOverlay: document.getElementById('networkOverlay'),
      networkCloseBtn: document.getElementById('networkCloseBtn'),
      networkStatus: document.getElementById('networkStatusText'),
      networkTimerStatus: document.getElementById('networkTimerStatus'),
      autoToggleBtn: document.getElementById('autoToggleBtn')
    };
  }

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<button id="modeCpuBtn">CPU</button>' +
      '<button id="modeNetworkBtn">ネット対戦</button>' +
      '<button id="autoToggleBtn">AUTO: OFF</button>' +
      '<div id="control-panel"></div>' +
      '<div id="networkPanel"></div>' +
      '<input id="networkServerInput" type="text" />' +
      '<input id="networkPlayerNameInput" type="text" />' +
      '<input id="networkRoomIdInput" type="text" />' +
      '<input id="networkEnableDebugCheckbox" type="checkbox" />' +
      '<button id="networkCopyRoomBtn">部屋番号コピー</button>' +
      '<button id="networkCreateBtn">部屋作成</button>' +
      '<button id="networkJoinBtn">参加</button>' +
      '<button id="networkLeaveBtn">退出</button>' +
      '<div id="networkOverlay"></div>' +
      '<button id="networkCloseBtn">閉じる</button>' +
      '<div id="networkStatusText"></div>' +
      '<div id="networkTimerStatus"></div>' +
      '</body></html>',
      { url: 'http://localhost/' }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.addLog = jest.fn();
    global.updateCpuCharacter = jest.fn();
    window.setNetworkDebugModeAccess = jest.fn();

    createRoom = jest.fn(async () => ({ ok: true, roomId: 'A1B', networkDebugEnabled: true }));
    joinRoom = jest.fn(async () => ({ ok: true, roomId: 'A1B', networkDebugEnabled: false }));
    leaveRoom = jest.fn(async () => ({ ok: true }));
    window.NetworkMatchClient = {
      createRoom,
      joinRoom,
      leaveRoom,
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

  test('部屋番号コピーボタンで入力値をコピーできる', async () => {
    const roomInput = document.getElementById('networkRoomIdInput');
    const copyBtn = document.getElementById('networkCopyRoomBtn');
    const status = document.getElementById('networkStatusText');
    const writeText = jest.fn(async () => undefined);

    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    roomInput.value = 'a a!1';
    copyBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('AA1');
    expect(roomInput.value).toBe('AA1');
    expect(status.textContent).toContain('AA1');
  });

  test('部屋番号が空ならコピーせずエラーを表示する', async () => {
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

    expect(writeText).not.toHaveBeenCalled();
    expect(status.textContent).toBe('コピーする部屋番号がありません');
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
