import * as path from 'path';

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
    delete global.CPU_LV6_SHARED_PROFILE;
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

  test('initPolicyOnnxModel skips load when shared profile disables browser ONNX path', async () => {
    const configure = jest.fn();
    const loadFromUrl = jest.fn(async () => true);
    global.CPU_LV6_SHARED_PROFILE = {
      browser: {
        moveDecisionMode: 'policy-table-lookahead',
        cardDecisionMode: 'policy-table-core'
      }
    };
    global.window.CpuPolicyOnnxRuntime = { configure, loadFromUrl };

    await handlers.initPolicyOnnxModel();

    expect(configure).not.toHaveBeenCalled();
    expect(loadFromUrl).not.toHaveBeenCalled();
    expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.loaded).toBe(false);
    expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.skipReason).toBe('shared-profile-policy-table-parity');
  });

  test('initPolicyOnnxModel still loads target/value models when base ONNX path is skipped', async () => {
    const loadFromUrl = jest.fn(async () => true);
    const loadTargetModelFromUrl = jest.fn(async () => true);
    const loadValueModelFromUrl = jest.fn(async () => true);
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.CPU_LV6_SHARED_PROFILE = {
      browser: {
        moveDecisionMode: 'policy-table-lookahead',
        cardDecisionMode: 'policy-table-core'
      }
    };
    global.window.fetch = jest.fn(async (url) => {
      const s = String(url || '');
      const ok =
        s === './data/models/policy-target.onnx' ||
        s === './data/models/policy-target.onnx.meta.json' ||
        s === './data/models/policy-value.onnx' ||
        s === './data/models/policy-value.onnx.meta.json';
      return { ok, status: ok ? 200 : 404 };
    });
    global.window.CpuPolicyOnnxRuntime = {
      loadFromUrl,
      loadTargetModelFromUrl,
      loadValueModelFromUrl
    };

    try {
      await handlers.initPolicyOnnxModel();

      expect(loadFromUrl).not.toHaveBeenCalled();
      expect(loadTargetModelFromUrl).toHaveBeenCalledWith('./data/models/policy-target.onnx', './data/models/policy-target.onnx.meta.json');
      expect(loadValueModelFromUrl).toHaveBeenCalledWith('./data/models/policy-value.onnx', './data/models/policy-value.onnx.meta.json');
      expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.loaded).toBe(false);
      expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.skipReason).toBe('shared-profile-policy-table-parity');
      expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.targetLoaded).toBe(true);
      expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.valueLoaded).toBe(true);
      expect(consoleLog).not.toHaveBeenCalled();
    } finally {
      consoleLog.mockRestore();
    }
  });

  test('initPolicyOnnxModel configures and loads runtime when available', async () => {
    const configure = jest.fn();
    const loadFromUrl = jest.fn(async () => true);
    const ortApi = { Tensor: jest.fn(), InferenceSession: { create: jest.fn() } };
    global.location = { search: '?cpuOnnx=1' };
    global.window.ort = ortApi;
    global.window.CpuPolicyOnnxRuntime = { configure, loadFromUrl };

    await handlers.initPolicyOnnxModel();

    expect(configure).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      minLevel: 6,
      sourceUrl: 'data/models/policy-net.onnx',
      metaUrl: 'data/models/policy-net.onnx.meta.json',
      targetSourceUrl: 'data/models/policy-target.onnx',
      targetMetaUrl: 'data/models/policy-target.onnx.meta.json',
      valueSourceUrl: 'data/models/policy-value.onnx',
      valueMetaUrl: 'data/models/policy-value.onnx.meta.json',
      ortApi
    }));
    expect(typeof configure.mock.calls[0][0].readQuerySearch).toBe('function');
    expect(loadFromUrl).toHaveBeenCalledWith('data/models/policy-net.onnx', 'data/models/policy-net.onnx.meta.json');
  });

  test('initPolicyOnnxModel resolves root model path when relative path is missing', async () => {
    const configure = jest.fn();
    const loadFromUrl = jest.fn(async () => true);
    global.location = { search: '?cpuOnnx=1', pathname: '/app/index.html' };
    global.window.fetch = jest.fn(async (url) => {
      const s = String(url || '');
      const ok =
        s === '/data/models/policy-net.onnx' ||
        s === '/data/models/policy-net.onnx.meta.json';
      return { ok, status: ok ? 200 : 404 };
    });
    global.window.CpuPolicyOnnxRuntime = { configure, loadFromUrl };

    await handlers.initPolicyOnnxModel();

    expect(loadFromUrl).toHaveBeenCalledWith('/data/models/policy-net.onnx', '/data/models/policy-net.onnx.meta.json');
    expect(configure).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: '/data/models/policy-net.onnx',
      metaUrl: '/data/models/policy-net.onnx.meta.json',
      targetSourceUrl: '/data/models/policy-target.onnx',
      targetMetaUrl: '/data/models/policy-target.onnx.meta.json',
      valueSourceUrl: '/data/models/policy-value.onnx',
      valueMetaUrl: '/data/models/policy-value.onnx.meta.json'
    }));
  });

  test('manual policy loading does not replace a legacy policy when Lv10 is selected', async () => {
    const originalPolicy={level:6};
    global.cpuSmartness.white='10-observed-dark-dragon';
    global.mccfrPolicy=originalPolicy;
    global.CpuPolicy={loadPolicyForLevel:jest.fn()};
    await handlers.loadCpuPolicy();
    expect(global.CpuPolicy.loadPolicyForLevel).not.toHaveBeenCalled();
    expect(global.mccfrPolicy).toBe(originalPolicy);
    expect(global.addLog).toHaveBeenCalledWith('観測ダークドラゴンは学習モデルの読み込みが不要です');
  });

  test('initPolicyOnnxModel loads auxiliary target and value models when available', async () => {
    const configure = jest.fn();
    const loadFromUrl = jest.fn(async () => true);
    const loadTargetModelFromUrl = jest.fn(async () => true);
    const loadValueModelFromUrl = jest.fn(async () => true);
    global.location = { search: '?cpuOnnx=1', pathname: '/app/index.html' };
    global.window.fetch = jest.fn(async (url) => {
      const s = String(url || '');
      const ok =
        s === '/data/models/policy-net.onnx' ||
        s === '/data/models/policy-net.onnx.meta.json' ||
        s === '/data/models/policy-target.onnx' ||
        s === '/data/models/policy-target.onnx.meta.json' ||
        s === '/data/models/policy-value.onnx' ||
        s === '/data/models/policy-value.onnx.meta.json';
      return { ok, status: ok ? 200 : 404 };
    });
    global.window.CpuPolicyOnnxRuntime = { configure, loadFromUrl, loadTargetModelFromUrl, loadValueModelFromUrl };

    await handlers.initPolicyOnnxModel();

    expect(configure).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: '/data/models/policy-net.onnx',
      metaUrl: '/data/models/policy-net.onnx.meta.json',
      targetSourceUrl: '/data/models/policy-target.onnx',
      targetMetaUrl: '/data/models/policy-target.onnx.meta.json',
      valueSourceUrl: '/data/models/policy-value.onnx',
      valueMetaUrl: '/data/models/policy-value.onnx.meta.json'
    }));
    expect(loadTargetModelFromUrl).toHaveBeenCalledWith('/data/models/policy-target.onnx', '/data/models/policy-target.onnx.meta.json');
    expect(loadValueModelFromUrl).toHaveBeenCalledWith('/data/models/policy-value.onnx', '/data/models/policy-value.onnx.meta.json');
  });

  test('initPolicyOnnxModel records critical status when model assets are missing', async () => {
    global.location = { search: '?cpuOnnx=1' };
    global.window.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    global.window.CpuPolicyOnnxRuntime = { configure: jest.fn(), loadFromUrl: jest.fn(async () => true) };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await handlers.initPolicyOnnxModel();

    expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.loaded).toBe(false);
    expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.lastError).toMatch(/missing policy-net assets/i);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  test('initPolicyTableModel configures and loads runtime when available', async () => {
    const configure = jest.fn();
    const loadFromUrl = jest.fn(async () => true);
    const getStatus = jest.fn(() => ({ statesCount: 12 }));
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.window.CpuPolicyTableRuntime = { configure, loadFromUrl, getStatus };

    try {
      await handlers.initPolicyTableModel();

      expect(configure).toHaveBeenCalledWith({
        enabled: true,
        minLevel: 6,
        sourceUrl: 'data/models/policy-table.json'
      });
      expect(loadFromUrl).toHaveBeenCalledWith('data/models/policy-table.json');
      expect(consoleLog).not.toHaveBeenCalled();
    } finally {
      consoleLog.mockRestore();
    }
  });

  test('initPolicyTableModel resolves root path when relative model path is missing', async () => {
    const configure = jest.fn();
    const loadFromUrl = jest.fn(async () => true);
    const getStatus = jest.fn(() => ({ statesCount: 42 }));
    global.location = { search: '', pathname: '/app/index.html' };
    global.window.fetch = jest.fn(async (url) => {
      const s = String(url || '');
      const ok = s === '/data/models/policy-table.json';
      return { ok, status: ok ? 200 : 404 };
    });
    global.window.CpuPolicyTableRuntime = { configure, loadFromUrl, getStatus };

    await handlers.initPolicyTableModel();

    expect(loadFromUrl).toHaveBeenCalledWith('/data/models/policy-table.json');
    expect(configure).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: '/data/models/policy-table.json'
    }));
  });

  test('initPolicyTableModel records critical status when model asset is missing', async () => {
    global.window.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    global.window.CpuPolicyTableRuntime = {
      configure: jest.fn(),
      loadFromUrl: jest.fn(async () => true)
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await handlers.initPolicyTableModel();

    expect(global.window.__CPU_MODEL_LOAD_STATUS__.table.loaded).toBe(false);
    expect(global.window.__CPU_MODEL_LOAD_STATUS__.table.lastError).toMatch(/missing policy-table asset/i);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  test('initPolicyTableModel skips direct probes when worker model manifest excludes the asset', async () => {
    const fetch = jest.fn(async (url) => {
      if (String(url) === 'data/models/model-assets.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schemaVersion: 'model_assets.v1',
            files: [
              'data/models/policy-net.onnx',
              'data/models/policy-net.onnx.meta.json'
            ]
          })
        };
      }
      const s = String(url || '');
      const ok =
        s.endsWith('data/models/policy-net.onnx') ||
        s.endsWith('data/models/policy-net.onnx.meta.json');
      if (ok) return { ok: true, status: 200 };
      return { ok: false, status: 404 };
    });
    const loadFromUrl = jest.fn(async () => true);
    global.window.fetch = fetch;
    global.window.CpuPolicyTableRuntime = {
      configure: jest.fn(),
      loadFromUrl
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await handlers.initPolicyTableModel();

    expect(fetch).toHaveBeenCalledWith('data/models/model-assets.json', { cache: 'no-store' });
    expect(fetch).toHaveBeenCalledWith('data/models/model-assets.json', { cache: 'no-store' });
    expect(loadFromUrl).not.toHaveBeenCalled();
    expect(global.window.__CPU_MODEL_LOAD_STATUS__.table.skipped).toBe(true);
    expect(global.window.__CPU_MODEL_LOAD_STATUS__.table.skipReason).toBe('model-asset-unavailable');
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  test('initPolicyOnnxModel skips auxiliary probes when worker model manifest excludes target and value assets', async () => {
    const fetch = jest.fn(async (url) => {
      if (String(url) === 'data/models/model-assets.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            schemaVersion: 'model_assets.v1',
            files: [
              'data/models/policy-net.onnx',
              'data/models/policy-net.onnx.meta.json'
            ]
          })
        };
      }
      const s = String(url || '');
      const ok =
        s.endsWith('data/models/policy-net.onnx') ||
        s.endsWith('data/models/policy-net.onnx.meta.json');
      if (ok) return { ok: true, status: 200 };
      return { ok: false, status: 404 };
    });
    const loadTargetModelFromUrl = jest.fn(async () => true);
    const loadValueModelFromUrl = jest.fn(async () => true);
    global.window.fetch = fetch;
    global.window.CpuPolicyOnnxRuntime = {
      loadFromUrl: jest.fn(async () => true),
      loadTargetModelFromUrl,
      loadValueModelFromUrl
    };

    await handlers.initPolicyOnnxModel();

    expect(fetch).toHaveBeenCalledWith('data/models/model-assets.json', { cache: 'no-store' });
    expect(loadTargetModelFromUrl).not.toHaveBeenCalled();
    expect(loadValueModelFromUrl).not.toHaveBeenCalled();
    expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.targetSkipped).toBe(true);
    expect(global.window.__CPU_MODEL_LOAD_STATUS__.onnx.valueSkipped).toBe(true);
  });

  test('initPolicyTableModel times out hung runtime load for safe fallback', async () => {
    global.window.CPU_MODEL_LOAD_TIMEOUT_MS = 1;
    global.window.CpuPolicyTableRuntime = {
      configure: jest.fn(),
      loadFromUrl: jest.fn(() => new Promise(() => {}))
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(handlers.initPolicyTableModel()).resolves.toBeUndefined();

    expect(global.window.__CPU_MODEL_LOAD_STATUS__.table.loaded).toBe(false);
    expect(global.window.__CPU_MODEL_LOAD_STATUS__.table.lastError).toMatch(/policy-table load timed out/i);

    consoleError.mockRestore();
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
