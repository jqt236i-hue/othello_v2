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
  });

  test('resetGame waits for ONNX and policy-table initialization', async () => {
    const onnxLoad = deferred();
    const tableLoad = deferred();
    global.initPolicyOnnxModel = jest.fn(() => onnxLoad.promise);
    global.initPolicyTableModel = jest.fn(() => tableLoad.promise);

    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: jest.fn()
    }), { virtual: false });

    import * as initModule from '../ui/handlers/init.js';
    const initPromise = initModule.initializeUI();

    expect(global.__uiInitialized).toBe(false);
    expect(global.initPolicyOnnxModel).toHaveBeenCalledTimes(1);
    expect(global.initPolicyTableModel).not.toHaveBeenCalled();
    expect(global.resetGame).not.toHaveBeenCalled();

    onnxLoad.resolve();
    await flushMicrotasks();

    expect(global.initPolicyTableModel).toHaveBeenCalledTimes(1);
    expect(global.resetGame).not.toHaveBeenCalled();
    expect(global.__uiInitialized).toBe(false);

    tableLoad.resolve();
    await initPromise;

    expect(global.resetGame).toHaveBeenCalledTimes(1);
    expect(global.__uiInitialized).toBe(true);
  });
});