jest.mock('../browser-vite/cpu-worker/worker-entry?worker', () => jest.fn(), { virtual: true });
jest.mock('../browser-vite/cpu-worker/lv10-worker-entry?worker', () => jest.fn(), { virtual: true });
jest.mock('../browser-vite/cpu-worker/lv11-worker-entry?worker', () => jest.fn(), { virtual: true });
jest.mock('../browser-vite/cpu-worker/lv12-worker-entry?worker', () => jest.fn(), { virtual: true });

import Lv10WorkerConstructor from '../browser-vite/cpu-worker/lv10-worker-entry?worker';
import Lv11WorkerConstructor from '../browser-vite/cpu-worker/lv11-worker-entry?worker';
import Lv12WorkerConstructor from '../browser-vite/cpu-worker/lv12-worker-entry?worker';
import { disableCpuWorkerBridge, getCpuWorkerBridge, installCpuWorkerBridge } from '../browser-vite/cpu-worker/bridge';
import { CpuWorkerClientError } from '../browser-vite/cpu-worker/client';
import { CPU_WORKER_PROTOCOL_VERSION } from '../browser-vite/cpu-worker/protocol';

const result = { version: 'isolation-test', transitions: 1, continuation: [], action: { type: 'pass' } };
const request: any = { observation: {
  schema: 'cpu_lv10_observation.v1', player: 'black',
  gameState: { turnNumber: 12 }, cardState: {}
} };

function setup() {
  function makeWorker() {
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
  return worker;
  }
  const worker = makeWorker(), lv11Worker = makeWorker(), lv12Worker = makeWorker();
  (Lv10WorkerConstructor as unknown as jest.Mock).mockImplementation(() => worker);
  (Lv11WorkerConstructor as unknown as jest.Mock).mockImplementation(() => lv11Worker);
  (Lv12WorkerConstructor as unknown as jest.Mock).mockImplementation(() => lv12Worker);
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
    expect(Object.keys(injected())).toEqual(['adviseLv10InWorker', 'adviseLv11InWorker', 'adviseLv12InWorker']);
    await expect(injected().adviseLv11InWorker(request)).resolves.toEqual(result);
    await expect(injected().adviseLv12InWorker(request)).resolves.toEqual(result);
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
    bridge.lv11Client.terminate();
    bridge.lv12Client.terminate();
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
    expect(Object.keys(injected())).toEqual(['adviseLv11InWorker', 'adviseLv12InWorker']);
    await expect(injected().adviseLv11InWorker(request)).resolves.toEqual(result);
    bridge.lv11Client.terminate();
    bridge.lv12Client.terminate();
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__.cpuLv10AdvisorWorker).toBe(false);
  });
  test('a fatal Lv11 failure leaves the Lv10 and legacy workers available', async () => {
    const { root, bridge, injected } = setup();
    const terminateLegacy = jest.spyOn(bridge.client, 'terminate');
    jest.spyOn(bridge.lv11Client, 'request').mockRejectedValue(new CpuWorkerClientError('Lv11 crash', 'TEST_CRASH', false));
    await expect(bridge.adviseLv11InWorker(request)).rejects.toThrow('Lv11 crash');
    expect(terminateLegacy).not.toHaveBeenCalled();
    await expect(bridge.adviseLv10InWorker(request)).resolves.toEqual(result);
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__).toMatchObject({ cpuLv11AdvisorWorker: false, cpuLv10AdvisorWorker: true });
    await expect(bridge.adviseLv12InWorker(request)).resolves.toEqual(result);
    disableCpuWorkerBridge(root, bridge);
    expect(Object.keys(injected())).toEqual(['adviseLv10InWorker', 'adviseLv12InWorker']);
    bridge.lv10Client.terminate();
  });
  test('a fatal Lv12 failure leaves Lv10, Lv11 and legacy workers available', async () => {
    const { root, bridge, injected } = setup();
    const terminateLegacy = jest.spyOn(bridge.client, 'terminate');
    jest.spyOn(bridge.lv12Client, 'request').mockRejectedValue(new CpuWorkerClientError('Lv12 crash', 'TEST_CRASH', false));
    await expect(bridge.adviseLv12InWorker(request)).rejects.toThrow('Lv12 crash');
    expect(terminateLegacy).not.toHaveBeenCalled();
    await expect(bridge.adviseLv10InWorker(request)).resolves.toEqual(result);
    await expect(bridge.adviseLv11InWorker(request)).resolves.toEqual(result);
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__).toMatchObject({ cpuLv12AdvisorWorker: false, cpuLv11AdvisorWorker: true, cpuLv10AdvisorWorker: true });
    disableCpuWorkerBridge(root, bridge);
    expect(Object.keys(injected())).toEqual(['adviseLv10InWorker', 'adviseLv11InWorker']);
    bridge.lv10Client.terminate();
    bridge.lv11Client.terminate();
  });
});
