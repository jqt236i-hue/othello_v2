jest.mock('../browser-vite/cpu-worker/worker-entry?worker', () => jest.fn(), { virtual: true });
jest.mock('../browser-vite/cpu-worker/lv10-worker-entry?worker', () => jest.fn(), { virtual: true });

import Lv10WorkerConstructor from '../browser-vite/cpu-worker/lv10-worker-entry?worker';
import { disableCpuWorkerBridge, getCpuWorkerBridge, installCpuWorkerBridge } from '../browser-vite/cpu-worker/bridge';
import { CpuWorkerClientError } from '../browser-vite/cpu-worker/client';
import { CPU_WORKER_PROTOCOL_VERSION } from '../browser-vite/cpu-worker/protocol';

const result = { version: 'isolation-test', transitions: 1, continuation: [], action: { type: 'pass' } };
const request: any = { observation: {
  schema: 'cpu_lv10_observation.v1', player: 'black',
  gameState: { turnNumber: 12 }, cardState: {}
} };

function setup() {
  const worker: any = {
    onmessage: null, onerror: null, onmessageerror: null,
    terminate: jest.fn(),
    postMessage(message: any) {
      queueMicrotask(() => worker.onmessage?.({ data: {
        protocolVersion: CPU_WORKER_PROTOCOL_VERSION, kind: 'response', ok: true,
        requestId: message.requestId, operation: message.operation,
        decisionEpoch: message.decisionEpoch, stateVersion: message.stateVersion,
        turnNumber: message.turnNumber, result
      } }));
    }
  };
  (Lv10WorkerConstructor as unknown as jest.Mock).mockImplementation(() => worker);
  let injected: any;
  const root: any = {
    Worker: function () {},
    UIBootstrap: { configureCpuCandidateScoring: jest.fn(value => { injected = value; }) }
  };
  const bridge = installCpuWorkerBridge(root, {} as Document)!;
  return { root, bridge, worker, injected: () => injected };
}

describe('independent Lv10 Worker lifecycle', () => {
  test('legacy shutdown preserves a live Lv10 advisor while disabling every legacy injection', async () => {
    const { root, bridge, worker, injected } = setup();
    const terminateLegacy = jest.spyOn(bridge.client, 'terminate');
    await expect(bridge.adviseLv10InWorker(request)).resolves.toEqual(result);

    disableCpuWorkerBridge(root, bridge);

    expect(terminateLegacy).toHaveBeenCalledTimes(1);
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(Object.keys(injected())).toEqual(['adviseLv10InWorker']);
    await expect(injected().adviseLv10InWorker(request)).resolves.toEqual(result);
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__).toMatchObject({
      cpuLv10AdvisorWorker: true, cpuCandidateScoringWorker: false,
      cpuCardQuiescenceWorker: false, dedicatedCpuWorker: false, onnxInferenceWorker: false
    });
    expect(getCpuWorkerBridge(root)).toBeNull();
    expect(installCpuWorkerBridge(root, {} as Document)).toBeNull();
    disableCpuWorkerBridge(root, bridge);
    expect(terminateLegacy).toHaveBeenCalledTimes(1);
    await expect(injected().adviseLv10InWorker(request)).resolves.toEqual(result);
    bridge.lv10Client.terminate();
  });

  test('ONNX session detach and asynchronous legacy fallback still run without clearing Lv10', async () => {
    const { root, bridge, injected } = setup();
    const configure = jest.fn(), clearModel = jest.fn();
    root.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__ = {};
    root.require = () => ({ configure, clearModel });
    root.LazyRuntimeLoaderModule = { activateMainThreadOnnxFallback: jest.fn(async () => true) };

    disableCpuWorkerBridge(root, bridge);
    await expect(root.__CARD_REVERSI_ONNX_MAIN_THREAD_FALLBACK__).resolves.toBe(true);
    expect(configure).toHaveBeenCalledTimes(2);
    expect(clearModel).toHaveBeenCalledTimes(2);
    expect(root.LazyRuntimeLoaderModule.activateMainThreadOnnxFallback).toHaveBeenCalledTimes(1);
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__).toMatchObject({ cpuLv10AdvisorWorker: true, onnxMainThreadFallbackActive: true });
    await expect(injected().adviseLv10InWorker(request)).resolves.toEqual(result);
    bridge.lv10Client.terminate();
  });

  test('a fatal Lv10 failure does not disable the legacy client or resurrect a failed advisor', async () => {
    const { root, bridge, injected } = setup();
    const terminateLegacy = jest.spyOn(bridge.client, 'terminate');
    jest.spyOn(bridge.lv10Client, 'request').mockRejectedValue(new CpuWorkerClientError('Lv10 crash', 'TEST_CRASH', false));
    await expect(bridge.adviseLv10InWorker(request)).rejects.toThrow('Lv10 crash');
    expect(terminateLegacy).not.toHaveBeenCalled();
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__).toMatchObject({ cpuLv10AdvisorWorker: false, cpuCandidateScoringWorker: true });
    disableCpuWorkerBridge(root, bridge);
    expect(injected()).toBeNull();
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__.cpuLv10AdvisorWorker).toBe(false);
  });
});
