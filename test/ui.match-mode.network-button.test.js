const { JSDOM } = require('jsdom');

describe('match-mode network button behavior', () => {
  let dom;
  let leaveRoom;

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

    leaveRoom = jest.fn(async () => ({ ok: true }));
    window.NetworkMatchClient = {
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
});
