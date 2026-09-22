import { JSDOM } from 'jsdom';

describe('custom board reset bridge', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(`<!doctype html><html><body>
      <button id="openBtn" type="button"></button>
      <div id="summary"></div>
      <div id="overlay"></div>
      <button id="closeBtn" type="button"></button>
      <div id="header"></div>
      <div id="body"></div>
      <button id="boardSizeOpenBtn" type="button"></button>
      <div id="boardSizeControlSummary"></div>
      <div id="boardSizeEditor"></div>
      <input id="boardSizeRowsInput" type="number" value="8" />
      <input id="boardSizeColsInput" type="number" value="8" />
      <button id="boardSizeCloseBtn" type="button"></button>
      <div id="boardSizeEditorNote"></div>
      <select id="smartBlack"><option value="1" selected>1</option></select>
      <select id="smartWhite">
        <option value="1">1</option>
        <option value="8-theory-incarnation">Lv8: 理論の化身</option>
      </select>
    </body></html>`, { url: 'http://localhost/' });

    global.window = dom.window as any;
    global.document = dom.window.document as any;
    global.location = dom.window.location as any;
    global.history = dom.window.history as any;
    global.localStorage = dom.window.localStorage as any;
    global.navigator = dom.window.navigator as any;

    global.GameEvents = {
      EVENT_TYPES: {
        BOARD_UPDATED: 'BOARD_UPDATED',
        GAME_STATE_CHANGED: 'GAME_STATE_CHANGED',
        GAME_RESET: 'GAME_RESET',
        LOG_ADDED: 'LOG_ADDED'
      },
      gameEvents: {
        emit: jest.fn()
      }
    } as any;
    global.cardState = {
      pendingEffectByPlayer: {},
      presentationEvents: [],
      _presentationEventsPersist: []
    } as any;
    global.dealInitialCards = jest.fn(() => new Promise(() => {}));
    global.updateCpuCharacter = jest.fn();

    const CardLogic = require('../game/logic/cards.js');
    const CoreLogic = require('../game/logic/core.js');
    (global.window as any).CardLogic = CardLogic;
    (global.window as any).CoreLogic = CoreLogic;
    global.CardLogic = CardLogic;
    const Prng = require('../game/schema/prng');
    global.initCardState = (_seed: any, options: any) => {
      Object.assign(global.cardState, CardLogic.createCardState(Prng.createPRNG(1), options));
    };
    global.CoreLogic = CoreLogic;
    (global.window as any).SharedUIBootstrap = require('../shared/ui-bootstrap-shared');
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
    delete global.history;
    delete global.localStorage;
    delete global.navigator;
    delete global.GameEvents;
    delete global.cardState;
    delete global.dealInitialCards;
    delete global.updateCpuCharacter;
    delete global.CardLogic;
    delete global.initCardState;
    delete global.CoreLogic;
    delete global.SharedUIBootstrap;
    delete global.__uiImpl_turn_manager;
    delete global.resetGame;
    delete global.handleCellClick;
    delete global.gameState;
  });

  test('resetGame reflects the locally selected 6x6 board config', () => {
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const controller = createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body: document.getElementById('body'),
        boardSizeOpenBtn: document.getElementById('boardSizeOpenBtn'),
        boardSizeControlSummary: document.getElementById('boardSizeControlSummary'),
        boardSizeEditor: document.getElementById('boardSizeEditor'),
        boardSizeRowsInput: document.getElementById('boardSizeRowsInput'),
        boardSizeColsInput: document.getElementById('boardSizeColsInput'),
        boardSizeCloseBtn: document.getElementById('boardSizeCloseBtn'),
        boardSizeEditorNote: document.getElementById('boardSizeEditorNote')
      }
    });
    controller.setLocalBoardConfig({ rows: 6, cols: 6 });

    const turnManager = require('../game/turn-manager.js');
    turnManager.setUIImpl({
      getRuntimeRoot: () => global,
      readRuntimeValue: (key: string) => global[key],
      writeRuntimeValue: (key: string, value: any) => { global[key] = value; },
      readCpuSmartness: () => ({ black: 1, white: 1 }),
      clearLogUI: jest.fn(),
      resetTransientUIState: jest.fn(),
      pulseDeckUI: jest.fn(),
      scheduleCpuTurn: (_ms: number, cb: () => void) => Promise.resolve().then(cb),
      isDocumentHidden: () => false
    });

    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      turnManager.resetGame();
    } finally {
      consoleLog.mockRestore();
    }

    expect(global.gameState.board).toHaveLength(6);
    expect(global.gameState.board[0]).toHaveLength(6);
    expect(global.gameState.boardConfig).toMatchObject({
      rows: 6,
      cols: 6,
      standard8x8: false
    });
  });

  test('resetGame applies Lv8 theory incarnation initial white charge from the CPU selector', () => {
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const smartWhite = document.getElementById('smartWhite') as HTMLSelectElement;
    smartWhite.value = '8-theory-incarnation';

    createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body: document.getElementById('body'),
        boardSizeOpenBtn: document.getElementById('boardSizeOpenBtn'),
        boardSizeControlSummary: document.getElementById('boardSizeControlSummary'),
        boardSizeEditor: document.getElementById('boardSizeEditor'),
        boardSizeRowsInput: document.getElementById('boardSizeRowsInput'),
        boardSizeColsInput: document.getElementById('boardSizeColsInput'),
        boardSizeCloseBtn: document.getElementById('boardSizeCloseBtn'),
        boardSizeEditorNote: document.getElementById('boardSizeEditorNote')
      }
    });

    const turnManager = require('../game/turn-manager.js');
    turnManager.setUIImpl({
      getRuntimeRoot: () => global,
      readRuntimeValue: (key: string) => global[key],
      writeRuntimeValue: (key: string, value: any) => { global[key] = value; },
      readCpuSmartness: () => ({ black: 1, white: 7 }),
      clearLogUI: jest.fn(),
      resetTransientUIState: jest.fn(),
      pulseDeckUI: jest.fn(),
      scheduleCpuTurn: (_ms: number, cb: () => void) => Promise.resolve().then(cb),
      isDocumentHidden: () => false
    });

    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      turnManager.resetGame();
    } finally {
      consoleLog.mockRestore();
    }

    expect(global.cardState.charge.white).toBe(50);
    expect(global.cardState.charge.black).toBe(0);
  });
});
