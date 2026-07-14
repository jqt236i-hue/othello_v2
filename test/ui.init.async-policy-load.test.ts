import * as path from 'path';
import { JSDOM } from 'jsdom';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function readyBoardVisualController() {
  return {
    waitUntilReady: jest.fn(async () => undefined),
    isReady: jest.fn(() => true),
    getVisualFrameDigest: jest.fn(() => 'initial-frame')
  };
}

describe('initializeUI async policy loading', () => {
  beforeEach(() => {
    jest.resetModules();

    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.CpuPolicy = { loadPolicyForLevel: jest.fn() };
    global.loadCpuPolicy = jest.fn();
    global.resetGame = jest.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.CpuPolicy;
    delete global.loadCpuPolicy;
    delete global.initPolicyOnnxModel;
    delete global.initPolicyTableModel;
    delete global.resetGame;
    delete global.setupMatchModeControls;
    delete global.restoreStoredNetworkSessionOnBoot;
  });

  test('bootstrap reset does not eagerly load ONNX or policy-table initialization', async () => {
    const onnxLoad = deferred();
    const tableLoad = deferred();
    global.initPolicyOnnxModel = jest.fn(() => onnxLoad.promise);
    global.initPolicyTableModel = jest.fn(() => tableLoad.promise);

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn(),
      getBoardVisualController: jest.fn(() => readyBoardVisualController())
    }), { virtual: false });

    const initModule = require('../ui/handlers/init.js');
    await initModule.initializeUI();

    expect(global.initPolicyOnnxModel).not.toHaveBeenCalled();
    expect(global.initPolicyTableModel).not.toHaveBeenCalled();
    expect(global.resetGame).toHaveBeenCalledTimes(1);
    expect(global.__uiInitialized).toBe(true);
  });

  test('saved network session restore runs after bootstrap reset', async () => {
    const calls = [];
    global.resetGame = jest.fn(() => {
      calls.push('reset');
    });
    global.setupMatchModeControls = jest.fn((opts) => {
      calls.push(`setup:${opts && opts.deferStoredSessionRestore === true ? 'defer' : 'immediate'}`);
    });
    global.restoreStoredNetworkSessionOnBoot = jest.fn(async () => {
      calls.push('restore');
    });

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn(),
      getBoardVisualController: jest.fn(() => readyBoardVisualController())
    }), { virtual: false });

    const initModule = require('../ui/handlers/init.js');
    await initModule.initializeUI();

    expect(global.setupMatchModeControls).toHaveBeenCalledWith(expect.objectContaining({
      deferStoredSessionRestore: true
    }));
    expect(global.restoreStoredNetworkSessionOnBoot).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(expect.arrayContaining(['setup:defer', 'reset', 'restore']));
    expect(calls.indexOf('reset')).toBeLessThan(calls.indexOf('restore'));
  });

  test('board readiness gates input listeners, stored-session restore, and app-ready', async () => {
    const visualReady = deferred();
    global.setupMatchModeControls = jest.fn();
    global.restoreStoredNetworkSessionOnBoot = jest.fn(async () => undefined);
    const controller = {
      waitUntilReady: jest.fn(() => visualReady.promise),
      isReady: jest.fn(() => true),
      getVisualFrameDigest: jest.fn(() => 'initial-frame')
    };
    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn(),
      getBoardVisualController: jest.fn(() => controller)
    }), { virtual: false });

    const initModule = require('../ui/handlers/init.js');
    const initializePromise = initModule.initializeUI();
    await flushMicrotasks();

    expect(global.resetGame).toHaveBeenCalledTimes(1);
    expect(global.setupMatchModeControls).not.toHaveBeenCalled();
    expect(global.restoreStoredNetworkSessionOnBoot).not.toHaveBeenCalled();
    expect(global.__uiInitialized).toBe(false);

    visualReady.resolve();
    await initializePromise;
    expect(global.setupMatchModeControls).toHaveBeenCalled();
    expect(global.restoreStoredNetworkSessionOnBoot).toHaveBeenCalledTimes(1);
    expect(global.__uiInitialized).toBe(true);
  });

  test('does not activate input or network when the initial board frame is unavailable', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.resetGame = jest.fn(() => { throw new Error('reset failed'); });
    global.setupMatchModeControls = jest.fn();
    global.restoreStoredNetworkSessionOnBoot = jest.fn(async () => undefined);
    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn(),
      getBoardVisualController: jest.fn(() => ({
        waitUntilReady: jest.fn(async () => undefined),
        isReady: jest.fn(() => true),
        getVisualFrameDigest: jest.fn(() => null)
      }))
    }), { virtual: false });

    try {
      const initModule = require('../ui/handlers/init.js');
      await expect(initModule.initializeUI()).rejects.toThrow('board_visual_initial_frame_unavailable');
      expect(global.setupMatchModeControls).not.toHaveBeenCalled();
      expect(global.restoreStoredNetworkSessionOnBoot).not.toHaveBeenCalled();
      expect(global.__uiInitialized).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  test.each([
    [
      'controller getter',
      { installGameDI: jest.fn() },
      'board_visual_controller_api_unavailable'
    ],
    [
      'readiness API',
      {
        installGameDI: jest.fn(),
        getBoardVisualController: jest.fn(() => ({
          isReady: jest.fn(() => true),
          getVisualFrameDigest: jest.fn(() => 'initial-frame')
        }))
      },
      'board_visual_controller_readiness_unavailable'
    ],
    [
      'ready-state API',
      {
        installGameDI: jest.fn(),
        getBoardVisualController: jest.fn(() => ({
          waitUntilReady: jest.fn(async () => undefined),
          getVisualFrameDigest: jest.fn(() => 'initial-frame')
        }))
      },
      'board_visual_controller_state_unavailable'
    ],
    [
      'frame-digest API',
      {
        installGameDI: jest.fn(),
        getBoardVisualController: jest.fn(() => ({
          waitUntilReady: jest.fn(async () => undefined),
          isReady: jest.fn(() => true)
        }))
      },
      'board_visual_controller_digest_unavailable'
    ]
  ])('fails closed when the board visual %s is unavailable', async (_label, bootstrapModule, expectedError) => {
    global.setupMatchModeControls = jest.fn();
    global.restoreStoredNetworkSessionOnBoot = jest.fn(async () => undefined);
    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => bootstrapModule, { virtual: false });

    const initModule = require('../ui/handlers/init.js');
    await expect(initModule.initializeUI()).rejects.toThrow(expectedError);
    expect(global.setupMatchModeControls).not.toHaveBeenCalled();
    expect(global.restoreStoredNetworkSessionOnBoot).not.toHaveBeenCalled();
    expect(global.__uiInitialized).toBe(false);
  });
});
