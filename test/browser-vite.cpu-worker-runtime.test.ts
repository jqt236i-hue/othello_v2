import { createCpuWorkerRuntime } from '../browser-vite/cpu-worker/worker-entry';
import {
  CPU_WORKER_OPERATIONS,
  CPU_WORKER_PROTOCOL_VERSION,
  type CpuWorkerOperation
} from '../browser-vite/cpu-worker/protocol';

function request(operation: CpuWorkerOperation, payload: unknown, requestId = 'cpu-1-1') {
  return {
    protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
    kind: 'request',
    requestId,
    operation,
    decisionEpoch: 1,
    stateVersion: null,
    turnNumber: null,
    payload
  };
}

function createPayload() {
  return {
    sessionKey: 'policy-placement',
    modelUrl: 'https://example.test/data/model.onnx',
    metaUrl: 'https://example.test/data/model.meta.json',
    wasmPathsUrl: 'https://example.test/node_modules/onnxruntime-web/dist/',
    executionProviders: ['webgpu', 'wasm']
  };
}

describe('Dedicated CPU Worker runtime', () => {
  test('answers a readiness probe without loading ORT', async () => {
    const ortLoader = jest.fn();
    const runtime = createCpuWorkerRuntime({ ortLoader });

    const response: any = await runtime.handleMessage(request(
      CPU_WORKER_OPERATIONS.PING,
      { probe: true }
    ));

    expect(response).toMatchObject({ ok: true, result: { ready: true } });
    expect(ortLoader).not.toHaveBeenCalled();
    expect(runtime.getStatus().ortLoaded).toBe(false);
  });

  test('owns ORT session creation, tensor construction, inference, and release', async () => {
    const run = jest.fn(async (feeds: any) => ({
      logits: { type: 'float32', data: new Float32Array([0.1, 0.9]), dims: [1, 2] },
      value: { type: 'float32', data: new Float32Array([0.4]), dims: [1] }
    }));
    const release = jest.fn();
    const create = jest.fn(async () => ({
      inputNames: ['obs'],
      outputNames: ['logits', 'value'],
      run,
      release
    }));
    const Tensor = jest.fn(function Tensor(this: any, type: string, data: unknown, dims: number[]) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    });
    const ort: any = {
      env: { wasm: {} },
      Tensor,
      InferenceSession: { create }
    };
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.endsWith('.meta.json')) {
        return { ok: true, json: async () => ({ inputName: 'obs', outputName: 'logits' }) };
      }
      return { ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
    });
    const ortLoader = jest.fn(async () => ort);
    const runtime = createCpuWorkerRuntime({
      ortLoader,
      fetchImpl: fetchImpl as any
    });

    const created: any = await runtime.handleMessage(request(
      CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION,
      createPayload()
    ));
    expect(created.ok).toBe(true);
    expect(created.result).toMatchObject({
      sessionKey: 'policy-placement',
      inputNames: ['obs'],
      outputNames: ['logits', 'value'],
      executionProviders: ['webgpu', 'wasm'],
      meta: { inputName: 'obs', outputName: 'logits' }
    });
    expect(create).toHaveBeenCalledWith(expect.any(Uint8Array), {
      executionProviders: ['webgpu', 'wasm']
    });
    expect(ortLoader).toHaveBeenCalledWith({
      scriptUrl: 'https://example.test/node_modules/onnxruntime-web/dist/ort.webgpu.min.js',
      executionProviders: ['webgpu', 'wasm']
    });
    expect(ort.env.logLevel).toBe('error');
    expect(ort.env.wasm.wasmPaths).toBe(createPayload().wasmPathsUrl);
    expect(ort.env.wasm.proxy).toBe(false);

    const input = new Float32Array([3, 4]);
    const inferred: any = await runtime.handleMessage(request(
      CPU_WORKER_OPERATIONS.ONNX_RUN_SESSION,
      {
        sessionKey: 'policy-placement',
        input: { name: 'obs', type: 'float32', data: input, dims: [1, 2] }
      },
      'cpu-1-2'
    ));
    expect(inferred.ok).toBe(true);
    expect(inferred.result.outputs.map((one: any) => one.name)).toEqual(['logits', 'value']);
    expect(Tensor).toHaveBeenCalledWith('float32', input, [1, 2]);
    expect(run).toHaveBeenCalledWith({ obs: expect.objectContaining({ data: input, dims: [1, 2] }) });

    const released: any = await runtime.handleMessage(request(
      CPU_WORKER_OPERATIONS.ONNX_RELEASE_SESSION,
      { sessionKey: 'policy-placement' },
      'cpu-1-3'
    ));
    expect(released.result.released).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus().sessionKeys).toEqual([]);
  });

  test('suppresses a delayed inference response after cancellation', async () => {
    let resolveRun: ((value: any) => void) | null = null;
    const run = jest.fn(() => new Promise((resolve) => { resolveRun = resolve; }));
    const ort: any = {
      env: { wasm: {} },
      Tensor: function Tensor(this: any, type: string, data: unknown, dims: number[]) {
        this.type = type;
        this.data = data;
        this.dims = dims;
      },
      InferenceSession: {
        create: async () => ({ inputNames: ['obs'], outputNames: ['logits'], run })
      }
    };
    const runtime = createCpuWorkerRuntime({
      ortLoader: async () => ort,
      fetchImpl: (async (url: string) => (
        url.endsWith('.json')
          ? { ok: true, json: async () => ({}) }
          : { ok: true, arrayBuffer: async () => Uint8Array.from([1]).buffer }
      )) as any
    });
    await runtime.handleMessage(request(CPU_WORKER_OPERATIONS.ONNX_CREATE_SESSION, createPayload()));
    const runRequest = request(CPU_WORKER_OPERATIONS.ONNX_RUN_SESSION, {
      sessionKey: 'policy-placement',
      input: { name: 'obs', type: 'float32', data: new Float32Array([1]), dims: [1] }
    }, 'cpu-1-2');
    const pending = runtime.handleMessage(runRequest);
    await Promise.resolve();
    await runtime.handleMessage({
      protocolVersion: CPU_WORKER_PROTOCOL_VERSION,
      kind: 'cancel',
      requestId: 'cpu-1-2'
    });
    resolveRun!({ logits: { type: 'float32', data: new Float32Array([1]), dims: [1] } });

    await expect(pending).resolves.toBeNull();
    expect(runtime.getStatus()).toMatchObject({ activeRequests: 0, cancelledRequests: 0 });
  });

  test('rejects malformed envelopes before loading ORT', async () => {
    const ortLoader = jest.fn();
    const runtime = createCpuWorkerRuntime({ ortLoader });
    await expect(runtime.handleMessage({ kind: 'request' })).rejects.toThrow('protocol');
    expect(ortLoader).not.toHaveBeenCalled();
  });
});
