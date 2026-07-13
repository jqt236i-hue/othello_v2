import * as path from 'path';

function board8() {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
}

function paddedMeta(outputName: string) {
  return {
    schemaVersion: 'policy_onnx.v1',
    inputName: 'obs',
    outputName,
    placeOutputName: outputName,
    targetOutputName: outputName,
    valueOutputName: outputName,
    inputDim: 116,
    baseInputDim: 116,
    outputDim: 100,
    paddedBoardSize: 10,
    actionSpace: 'place_padded10'
  };
}

describe('ONNX runtimes with an injected Worker executor', () => {
  test('policy placement, pending target, and value heads keep main-thread output interpretation', async () => {
    jest.resetModules();
    const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-onnx-runtime.ts'));
    const createSession = jest.fn(async (options: any) => {
      const outputName = options.sessionKey === 'policy-target'
        ? 'target_logits'
        : options.sessionKey === 'policy-value'
          ? 'value'
          : 'place_logits';
      return {
        sessionKey: options.sessionKey,
        inputNames: ['obs'],
        outputNames: [outputName],
        meta: paddedMeta(outputName)
      };
    });
    const runSession = jest.fn(async (options: any) => {
      expect(options.data).toBeInstanceOf(Float32Array);
      expect(options.dims).toEqual([1, options.data.length]);
      if (options.session.sessionKey === 'policy-value') {
        return { value: { data: new Float32Array([0.625]), dims: [1], type: 'float32' } };
      }
      const data = new Float32Array(100);
      data[11] = 0.25;
      data[22] = 2.5;
      const name = options.session.sessionKey === 'policy-target' ? 'target_logits' : 'place_logits';
      return { [name]: { data, dims: [1, 100], type: 'float32' } };
    });
    const releaseSession = jest.fn(async () => true);
    const executor = { createSession, runSession, releaseSession };
    runtime.clearModel();
    runtime.configure({
      enabled: true,
      minLevel: 6,
      enableWebGpuExecution: false,
      inferenceExecutor: executor,
      ortApi: null
    });

    await expect(runtime.loadFromUrl('model.onnx', 'model.meta.json')).resolves.toBe(true);
    await expect(runtime.loadTargetModelFromUrl('target.onnx', 'target.meta.json')).resolves.toBe(true);
    await expect(runtime.loadValueModelFromUrl('value.onnx', 'value.meta.json')).resolves.toBe(true);
    expect(createSession.mock.calls.map((call) => call[0].sessionKey)).toEqual([
      'policy-placement',
      'policy-target',
      'policy-value'
    ]);

    const candidates = [{ row: 0, col: 0 }, { row: 1, col: 1 }];
    const context = { board: board8(), playerKey: 'white', level: 6, legalMovesCount: 2 };
    await expect(runtime.chooseMove(candidates, context)).resolves.toBe(candidates[1]);
    await expect(runtime.choosePendingTarget(candidates, context)).resolves.toBe(candidates[1]);
    await expect(runtime.evaluatePosition(context)).resolves.toBeCloseTo(0.625);

    runtime.clearModel();
    expect(releaseSession).toHaveBeenCalledTimes(3);
    runtime.configure({ inferenceExecutor: null });
  });

  test('preserves WebGPU-to-WASM session fallback at the injected boundary', async () => {
    jest.resetModules();
    const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-onnx-runtime.ts'));
    const createSession = jest.fn(async (options: any) => {
      if (options.executionProviders[0] === 'webgpu') throw new Error('webgpu unavailable');
      return {
        sessionKey: options.sessionKey,
        inputNames: ['obs'],
        outputNames: ['place_logits'],
        meta: paddedMeta('place_logits')
      };
    });
    runtime.clearModel();
    runtime.configure({
      enabled: true,
      minLevel: 6,
      enableWebGpuExecution: true,
      inferenceExecutor: { createSession, runSession: jest.fn() },
      ortApi: null
    });

    await expect(runtime.loadFromUrl('model.onnx', 'model.meta.json')).resolves.toBe(true);
    expect(createSession.mock.calls.map((call) => call[0].executionProviders)).toEqual([
      ['webgpu', 'wasm'],
      ['wasm']
    ]);
    runtime.clearModel();
    runtime.configure({ inferenceExecutor: null, enableWebGpuExecution: false });
  });

  test('othello policy/value runtime uses the same executor without moving rerank logic', async () => {
    jest.resetModules();
    const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'othello-onnx-runtime.ts'));
    const createSession = jest.fn(async (options: any) => ({
      sessionKey: options.sessionKey,
      inputNames: ['obs'],
      outputNames: ['logits', 'value'],
      meta: {
        inputName: 'obs',
        placeOutputName: 'logits',
        valueOutputName: 'value',
        inputDim: 80,
        outputDim: 64
      }
    }));
    const runSession = jest.fn(async (options: any) => {
      const logits = new Float32Array(64);
      logits[0] = 0.5;
      logits[9] = 3.25;
      return {
        logits: { data: logits, dims: [1, 64], type: 'float32' },
        value: { data: new Float32Array([0.1]), dims: [1], type: 'float32' }
      };
    });
    const executor = { createSession, runSession, releaseSession: jest.fn(async () => true) };
    runtime.clearModel();
    runtime.configure({
      enabled: true,
      minLevel: 6,
      useValueRerank: false,
      heuristicRerankWeight: 0,
      exactSolveEmpties: 0,
      inferenceExecutor: executor,
      ortApi: null
    });

    await expect(runtime.loadFromUrl('othello.onnx', 'othello.meta.json')).resolves.toBe(true);
    const candidates = [{ row: 0, col: 0 }, { row: 1, col: 1 }];
    await expect(runtime.chooseMove(candidates, {
      board: board8(),
      playerKey: 'white',
      level: 6,
      legalMovesCount: 2
    })).resolves.toBe(candidates[1]);
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionKey: 'othello-policy-value',
      executionProviders: ['wasm']
    }));
    expect(runSession).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus()).toMatchObject({ loaded: true, inferenceCalls: 1 });

    runtime.clearModel();
    runtime.configure({ inferenceExecutor: null });
  });

  test('returns null on Worker inference failure so the existing CPU fallback remains authoritative', async () => {
    jest.resetModules();
    const runtime = require(path.resolve(__dirname, '..', 'game', 'ai', 'policy-onnx-runtime.ts'));
    runtime.clearModel();
    runtime.configure({
      enabled: true,
      minLevel: 6,
      inferenceExecutor: {
        createSession: async (options: any) => ({
          sessionKey: options.sessionKey,
          inputNames: ['obs'],
          outputNames: ['place_logits'],
          meta: paddedMeta('place_logits')
        }),
        runSession: async () => { throw new Error('simulated Worker failure'); }
      },
      ortApi: null
    });
    await runtime.loadFromUrl('model.onnx', 'model.meta.json');

    await expect(runtime.chooseMove([{ row: 0, col: 0 }], {
      board: board8(),
      playerKey: 'white',
      level: 6,
      legalMovesCount: 1
    })).resolves.toBeNull();
    expect(runtime.getStatus().lastError).toContain('simulated Worker failure');
    runtime.clearModel();
    runtime.configure({ inferenceExecutor: null });
  });
});
