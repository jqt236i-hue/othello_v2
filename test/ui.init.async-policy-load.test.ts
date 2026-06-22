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
      installGameDI: jest.fn()
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
      installGameDI: jest.fn()
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
});
