import { JSDOM } from 'jsdom';

describe('debug hand refresh', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');

    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;

    global.window.DEBUG_MODE_ALLOWED = true;
    global.window.DEBUG_UNLIMITED_USAGE = true;
    global.window.DEBUG_HUMAN_VS_HUMAN = false;

    global.cardState = {
      debugHandFilled: true,
      hands: { black: ['free_01'], white: [] }
    };
    global.gameState = {
      currentPlayer: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.CardLogic = { getCardDef: jest.fn(() => null) };
    global.DebugActions = { fillDebugHand: jest.fn() };
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
    delete global.DebugActions;
    delete global.addLog;
    delete global.renderCardUI;
    delete global.NetworkMatchClient;
  });

  test('fillDebugHand still backfills missing cards after debug hand was already marked filled', () => {
    require('../cards/card-interaction.js');

    window.fillDebugHand();

    expect(global.DebugActions.fillDebugHand).toHaveBeenCalledWith(global.cardState, { fillWhite: false });
    expect(global.renderCardUI).toHaveBeenCalled();
  });

  test('network match中は debug fill hand を authority publish へ切り替える', async () => {
    global.NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(async () => ({ ok: true }))
    };

    require('../cards/card-interaction.js');

    window.fillDebugHand();
    await Promise.resolve();

    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      actionType: 'debug_fill_hand',
      action: expect.objectContaining({ type: 'debug_fill_hand' })
    }));
    expect(global.DebugActions.fillDebugHand).not.toHaveBeenCalled();
  });
});
