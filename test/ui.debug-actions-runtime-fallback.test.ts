import { JSDOM } from 'jsdom';

describe('debug actions runtime fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://127.0.0.1:8000/?debug=1' });
    global.window = dom.window as any;
    global.document = dom.window.document as any;
    global.location = dom.window.location as any;
    global.window.DEBUG_MODE_ALLOWED = true;
    global.window.DEBUG_UNLIMITED_USAGE = true;
    global.window.DEBUG_HUMAN_VS_HUMAN = true;
    global.cardState = {
      hands: { black: ['guard_01'], white: [] },
      charge: { black: 0, white: 0 },
      pendingEffectByPlayer: { black: null, white: null }
    };
    global.gameState = {
      currentPlayer: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.CardLogic = { getCardDef: jest.fn(() => null) };
    global.addLog = jest.fn();
    global.renderCardUI = jest.fn();
    global.NetworkMatchClient = undefined;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.location;
    delete global.cardState;
    delete global.gameState;
    delete global.CardLogic;
    delete global.addLog;
    delete global.renderCardUI;
    delete global.NetworkMatchClient;
    delete global.DebugActions;
  });

  test('fillDebugHand uses browser runtime module.exports fallback when window.DebugActions is missing', () => {
    const fillSpy = jest.fn(() => true);
    (global.window as any).module = { exports: { fillDebugHand: fillSpy, applyVisualTestBoard: jest.fn() } };
    (global.window as any).exports = (global.window as any).module.exports;

    require('../cards/card-interaction.js');

    (global.window as any).fillDebugHand();

    expect(typeof (global.window as any).DebugActions).toBe('object');
    expect(fillSpy).toHaveBeenCalledWith(global.cardState, { fillWhite: true });
    expect(global.renderCardUI).toHaveBeenCalled();
  });
});
