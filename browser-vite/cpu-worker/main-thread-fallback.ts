type RuntimeRoot = Window & Record<string, any>;

const ONNX_RUNTIME_MODULE_KEYS = [
  'game/ai/othello-onnx-runtime',
  'game/ai/policy-onnx-runtime'
] as const;

export interface OnnxWorkerDetachResult {
  hadWorkerExecutor: boolean;
  errors: Error[];
}

function normalizeError(error: unknown, moduleKey: string): Error {
  if (error instanceof Error) return error;
  return new Error(`failed to detach ONNX Worker executor from ${moduleKey}: ${String(error)}`);
}

/**
 * Detach Worker-owned ONNX sessions synchronously before an asynchronous
 * main-thread ORT fallback is started. Configuring the executor to null first
 * keeps clearModel() from trying to release sessions through a disabled client.
 */
export function detachOnnxWorkerExecutor(rootRef: RuntimeRoot): OnnxWorkerDetachResult {
  const hadWorkerExecutor = !!rootRef.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__;
  const errors: Error[] = [];

  if (hadWorkerExecutor && typeof rootRef.require !== 'function') {
    errors.push(new Error('CommonJS compatibility runtime is unavailable for ONNX Worker detach'));
  } else if (hadWorkerExecutor) {
    for (const moduleKey of ONNX_RUNTIME_MODULE_KEYS) {
      try {
        const runtime = rootRef.require(moduleKey);
        if (!runtime || typeof runtime.configure !== 'function') {
          throw new Error(`ONNX runtime module is unavailable: ${moduleKey}`);
        }
        runtime.configure({ inferenceExecutor: null });
        if (typeof runtime.clearModel === 'function') runtime.clearModel();
      } catch (error) {
        errors.push(normalizeError(error, moduleKey));
      }
    }
  }

  delete rootRef.__CARD_REVERSI_CPU_WORKER_CLIENT__;
  delete rootRef.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__;
  return { hadWorkerExecutor, errors };
}
