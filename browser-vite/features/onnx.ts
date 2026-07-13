import { loadOptionalFeatureRegistry, type OptionalFeatureContext } from './feature-registry';
import CpuWorkerConstructor from '../cpu-worker/worker-entry?worker';
import {
  createCpuWorkerClient,
  createOnnxWorkerInferenceExecutor
} from '../cpu-worker/client';

const ONNX_RUNTIME_MODULE_KEYS = [
  'game/ai/othello-onnx-runtime',
  'game/ai/policy-onnx-runtime'
] as const;

async function installWorkerExecutor(context: OptionalFeatureContext): Promise<boolean> {
  const rootRef = context.root;
  if (rootRef.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__) return true;
  if (typeof rootRef.Worker !== 'function') return false;
  if (typeof rootRef.require !== 'function') return false;

  const client = createCpuWorkerClient({
    workerFactory: () => new CpuWorkerConstructor({ name: 'card-reversi-cpu' }) as unknown as Worker,
    defaultTimeoutMs: 15000
  });
  try {
    if (!await client.probe(3000)) return false;
  } catch (error) {
    client.terminate('CPU Worker probe failed; use main-thread ONNX fallback');
    return false;
  }
  const executor = createOnnxWorkerInferenceExecutor({
    client,
    baseUrl: context.document.baseURI,
    wasmPathsUrl: new URL('node_modules/onnxruntime-web/dist/', context.document.baseURI).href,
    createTimeoutMs: 45000,
    runTimeoutMs: 5000,
    allowedExecutionProviders: ['wasm']
  });
  for (const moduleKey of ONNX_RUNTIME_MODULE_KEYS) {
    const runtime = rootRef.require(moduleKey);
    if (!runtime || typeof runtime.configure !== 'function') {
      throw new Error(`ONNX runtime module is unavailable: ${moduleKey}`);
    }
    runtime.configure({ inferenceExecutor: executor });
  }
  rootRef.__CARD_REVERSI_CPU_WORKER_CLIENT__ = client;
  rootRef.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__ = executor;
  rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__ = Object.freeze(Object.assign(
    {},
    rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__ || {},
    { dedicatedCpuWorker: true, onnxInferenceWorker: true }
  ));
  return true;
}

export async function loadOptionalFeature(context: OptionalFeatureContext): Promise<boolean> {
  await loadOptionalFeatureRegistry('onnx', context, [
    'game/ai/othello-onnx-runtime',
    'game/ai/policy-onnx-runtime'
  ]);
  await installWorkerExecutor(context);
  return true;
}
