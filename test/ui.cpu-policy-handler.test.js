const path = require('path');

describe('ui cpu-policy handler', () => {
  let handlers;

  beforeEach(() => {
    jest.resetModules();
    global.window = {};
    global.location = { search: '' };
    global.cpuSmartness = { white: 3, black: 3 };
    global.CpuPolicy = undefined;
    global.mccfrPolicy = null;
    global.addLog = jest.fn();
    handlers = require(path.resolve(__dirname, '..', 'ui', 'handlers', 'cpu-policy.js'));
  });

  afterEach(() => {
    delete global.window;
    delete global.location;
    delete global.cpuSmartness;
    delete global.CpuPolicy;
    delete global.mccfrPolicy;
    delete global.addLog;
  });

  test('initPolicyTableModel returns safely when runtime is unavailable', async () => {
    await expect(handlers.initPolicyTableModel()).resolves.toBeUndefined();
  });

  test('initPolicyOnnxModel returns safely when runtime is unavailable', async () => {
    await expect(handlers.initPolicyOnnxModel()).resolves.toBeUndefined();
  });

  test('initPolicyOnnxModel configures and loads runtime when available', async () => {
    const configure = jest.fn();
    const loadFromUrl = jest.fn(async () => true);
    global.window.CpuPolicyOnnxRuntime = { configure, loadFromUrl };

    await handlers.initPolicyOnnxModel();

    expect(configure).toHaveBeenCalledWith({
      enabled: true,
      minLevel: 6,
      sourceUrl: 'data/models/policy-net.onnx',
      metaUrl: 'data/models/policy-net.onnx.meta.json'
    });
    expect(loadFromUrl).toHaveBeenCalledWith('data/models/policy-net.onnx', 'data/models/policy-net.onnx.meta.json');
  });

  test('initPolicyTableModel configures and loads runtime when available', async () => {
    const configure = jest.fn();
    const loadFromUrl = jest.fn(async () => true);
    const getStatus = jest.fn(() => ({ statesCount: 12 }));
    global.window.CpuPolicyTableRuntime = { configure, loadFromUrl, getStatus };

    await handlers.initPolicyTableModel();

    expect(configure).toHaveBeenCalledWith({
      enabled: true,
      minLevel: 4,
      sourceUrl: 'data/models/policy-table.json'
    });
    expect(loadFromUrl).toHaveBeenCalledWith('data/models/policy-table.json');
  });

  test('initPolicyTableModel swallows runtime load errors for safe fallback', async () => {
    const loadFromUrl = jest.fn(async () => {
      throw new Error('fetch failed');
    });
    global.window.CpuPolicyTableRuntime = {
      configure: jest.fn(),
      loadFromUrl
    };

    await expect(handlers.initPolicyTableModel()).resolves.toBeUndefined();
    expect(loadFromUrl).toHaveBeenCalledTimes(1);
  });
});
